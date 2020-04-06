namespace Feliz.UseWorker

open Browser.Blob
open Browser.Dom
open Browser.Types
open Fable.Core
open Fable.Core.JsInterop

[<AutoOpen>]
module internal Internals =
    let inline depsParser (deps: string []) =
        match deps with
        | [||] -> None
        | _ ->
            deps
            |> String.concat ", "
            |> sprintf "importScripts('%s'); "
            |> Some

    [<Global>]
    let URL : obj = jsNative
    
    [<Emit("$0.toString()")>]
    let funToString f : string = jsNative

    [<Emit("postMessage($0)")>]
    let postMessage a = jsNative

    [<Emit("importScripts($0)")>]
    let importScripts s = jsNative

    /// Creates the worker blob url via stringifying the parameters.
    let inline createWorkerBlobUrl umdPath depArr jobRunner =
        let onMessage = 
            sprintf "onmessage=(%s)(%s)" 
                (funToString jobRunner) 
                (sprintf "(function (args) { return %s(args) })" umdPath)
    
        let blobOptions =
            jsOptions<BlobPropertyBag>(fun o ->
                o.``type`` <- "text/javascript")

        match depsParser depArr with
        | Some deps ->
            Blob.Create([| deps :> obj; onMessage :> obj |], blobOptions)
        | None -> Blob.Create([| onMessage :> obj |], blobOptions)
        |> URL?createObjectURL

    [<Emit("new Worker($0)")>]
    let newWorker blobUrl : Worker = jsNative

    module Async =
        let map f a =
            async {
                let! res = a
                return f res
            }

    [<Emit("setTimeout($0, $1)")>]
    let setTimeout (f: unit -> unit) (timeout: int) : int = jsNative

    [<Emit("clearTimeout($0)")>]
    let clearTimeout (id: int) : unit = jsNative

[<AutoOpen>]
module WebWorker =
    /// The status of a web worker instance.
    [<RequireQualifiedAccess>]
    type WorkerStatus =
        /// The worker has been initialized, but has not yet been executed.
        | Pending
        /// The worker has been executed correctly.
        | Success
        /// The worker is running.
        | Running
        /// The worker ended with an error.
        | Error
        /// The worker was killed via timeout expiration.
        | TimeoutExpired
        /// The worker process has been terminated.
        | Killed

    type private MailboxMessage<'Arg,'Result> =
        | Kill
        | Restart of Worker
        | RunFunction of 'Arg * AsyncReplyChannel<'Result>
        | SetStatus of WorkerStatus
        | WorkerResult of 'Result

    type private MailboxState<'T> =
        { ResultReplyChannel: AsyncReplyChannel<'T> option
          TimeoutId: int option
          WorkerState: WorkerStatus
          Worker: Worker }

    [<RequireQualifiedAccess>]
    type private WorkerSubscriberState =
        | Status of WorkerStatus
        | Kill

    type internal WorkerSubscriberMailbox (dispatch: WorkerStatus -> unit) =
        let mailbox =
            MailboxProcessor.Start <| fun inbox ->
                let rec loop () =
                    async {
                        let! msg = inbox.Receive()

                        return!
                            match msg with
                            | WorkerSubscriberState.Status status ->
                                printfn "%A" status
                                dispatch status
                                loop ()
                            | WorkerSubscriberState.Kill -> async { return () }
                    }

                loop ()

        member _.Kill () =
            mailbox.Post WorkerSubscriberState.Kill

        member _.PostStatus (status: WorkerStatus) =
            mailbox.Post(WorkerSubscriberState.Status status)

    type internal WorkerSubscriber =
        | Elmish of WorkerSubscriberMailbox
        | Hook of (WorkerStatus -> unit)

        member this.Post (status: WorkerStatus) =
            match this with
            | Elmish mailbox -> mailbox.PostStatus status
            | Hook dispatch -> dispatch status

        member this.Kill () =
            match this with
            | Elmish mailbox -> mailbox.Kill()
            | _ -> ()

    type Worker<'Arg,'Result> internal (umdPath: string, deps: string [], subscriber: WorkerSubscriber, ?timeout: int) =
        let createNewWorker () = 
            newWorker (createWorkerBlobUrl umdPath deps (fun f (e: MessageEvent) -> postMessage(f e.data)))

        let applyWorkerCommands (worker: Worker) (mailbox: MailboxProcessor<_>) =
            worker.onerror <- fun _ -> mailbox.Post (SetStatus WorkerStatus.Error)
            worker.onmessage <- fun msg -> mailbox.Post (WorkerResult (unbox<'Result> msg.data))

        let timeout = Option.defaultValue 5000 timeout
        let token = new System.Threading.CancellationTokenSource()

        let createMailbox (worker: Worker) =
            let mailbox = 
                MailboxProcessor.Start(fun inbox ->
                    let rec loop (state: MailboxState<'Result>) =
                        async {
                            let! msg = inbox.Receive()

                            let clearWorkerTimeout () =
                                state.TimeoutId 
                                |> Option.iter clearTimeout

                            return!
                                match msg with
                                | Kill ->
                                    clearWorkerTimeout()
                                    state.Worker.terminate()

                                    { state with 
                                        ResultReplyChannel = None
                                        TimeoutId = None
                                        WorkerState = WorkerStatus.Killed }
                                | Restart worker ->
                                    clearWorkerTimeout()
                                    state.Worker.terminate()

                                    { state with
                                        ResultReplyChannel = None
                                        TimeoutId = None
                                        WorkerState = 
                                            if state.TimeoutId.IsSome then WorkerStatus.TimeoutExpired
                                            else WorkerStatus.Pending
                                        Worker = worker }
                                | RunFunction (arg, replyChannel) ->
                                    state.Worker.postMessage arg

                                    { state with 
                                        ResultReplyChannel = Some replyChannel
                                        TimeoutId = 
                                            setTimeout (fun () -> inbox.Post(Restart state.Worker)) timeout
                                            |> Some
                                        WorkerState = WorkerStatus.Running }
                                | SetStatus result -> 
                                    clearWorkerTimeout()
                                    
                                    { state with 
                                        TimeoutId = None
                                        WorkerState = result }
                                | WorkerResult result ->
                                    clearWorkerTimeout()

                                    state.ResultReplyChannel
                                    |> Option.iter (fun replyChannel -> replyChannel.Reply result)

                                    { state with 
                                        ResultReplyChannel = None
                                        TimeoutId = None
                                        WorkerState = WorkerStatus.Success }
                                |> fun newState ->
                                    if state.WorkerState <> newState.WorkerState then
                                        subscriber.Post newState.WorkerState
                                    loop newState
                        }

                    { ResultReplyChannel = None
                      TimeoutId = None
                      WorkerState = WorkerStatus.Pending
                      Worker = worker }
                    |> loop
                , cancellationToken = token.Token)
        
            do applyWorkerCommands worker mailbox

            mailbox

        let mailbox = createMailbox(createNewWorker())

        interface System.IDisposable with
            member _.Dispose () = 
                mailbox.Post Kill
                token.Cancel()
                token.Dispose()
                subscriber.Kill()

        member _.Invoke (arg: 'Arg) =
            mailbox.PostAndAsyncReply(fun reply -> RunFunction(arg, reply))
            
        member _.Kill () =
            mailbox.Post Kill

        member _.Restart () =
            let worker = createNewWorker()
            do applyWorkerCommands worker mailbox

            mailbox.Post(Restart worker)

    /// Options for worker creation.
    type WorkerOptions =
        { /// The base path of where to load the worker script.
          ///
          /// Default: Tries to find the root via `document.
          /// location.href by splitting on `#` and taking the head, 
          /// if that fails it takes the `document.location.origin`. 
          /// `/Workers` is then appended to the result.
          BasePath: string
          /// A list of external dependencies such as an unpkg script.
          /// 
          /// This shouldn't be necessary, simply open the namespace/modules
          /// required and they will be included in the worker script.
          ///
          /// Default: []
          Dependencies: string list
          /// Sets the function name of the loaded umd module.
          ///
          /// Default: `None` - splits on `BasePath` by `.` and takes 
          /// the head.
          FunctionName: string option
          /// Timeout of worker function in ms.
          ///
          /// Default: `Some 5000`
          Timeout: int option }

    module internal Worker =
        let defaultOptions =
            { BasePath = 
                document.location.href.Split('#') 
                |> Array.tryHead
                |> function
                | Some url -> url.Remove(url.Length-1)
                | None -> document.location.origin
                |> sprintf "%s/Workers"
              FunctionName = None
              Dependencies = []
              Timeout = Some 5000 }

        /// Converts the umdPath and options into a list of dependencies for usage in the worker via importScripts
        let createDeps (umdPath: string) (options: WorkerOptions -> WorkerOptions) =
            let userOptions = options defaultOptions

            userOptions.FunctionName
            |> Option.defaultValue (umdPath.Split('.') |> Array.head)
            |> fun scriptName ->
                sprintf "%s/%s.js"
                    userOptions.BasePath
                    scriptName
            |> fun workerPath ->
                workerPath::userOptions.Dependencies
                |> Array.ofList

        /// Creates the mailbox processer with subscriber for elmish usage.
        let create<'Args,'Result> (umdPath: string, dispatch: WorkerStatus -> unit) =
            let workerSub = WorkerSubscriber.Elmish(new WorkerSubscriberMailbox(dispatch))

            new Worker<'Args, 'Result>(umdPath, createDeps umdPath id, workerSub, ?timeout = defaultOptions.Timeout)
        
        /// Creates the mailbox processer with subscriber and options for elmish usage.
        let createWithOptions<'Args, 'Result> (umdPath: string, dispatch: WorkerStatus -> unit, options: WorkerOptions -> WorkerOptions) =
            let workerSub = WorkerSubscriber.Elmish(new WorkerSubscriberMailbox(dispatch))
            let userOptions = options defaultOptions

            createDeps umdPath options
            |> fun deps ->
                new Worker<'Args, 'Result>(umdPath, deps, workerSub, ?timeout = userOptions.Timeout)

        /// Creates the mailbox processer and subscriber (callback) for the react hook.
        let createHookWorker<'Args, 'Result> (umdPath: string, dispatch: WorkerStatus -> unit, options: WorkerOptions -> WorkerOptions) =
            let workerSub = WorkerSubscriber.Hook(dispatch)
            let userOptions = options defaultOptions

            createDeps umdPath options
            |> fun deps ->
                new Worker<'Args, 'Result>(umdPath, deps, workerSub, ?timeout = userOptions.Timeout)

open Feliz

[<AutoOpen>]
module Feliz =
    type WorkerCommands<'Arg,'Result> =
        { /// Executes the worker function.
          exec: ('Arg * ('Result -> unit)) -> unit
          /// Terminates the worker instance.
          kill: unit -> unit
          /// Terminates the worker instance (if alive), then generates a new worker.
          restart: unit -> unit }

    type React with
        /// Creates the worker process.
        static member useWorker<'Arg, 'Result> (umdPath: string, options: WorkerOptions -> WorkerOptions) =
            let worker : Fable.React.IRefValue<Worker<'Arg, 'Result> option> = React.useRef(None)
            let workerStatus, setWorkerStatus = React.useState(WorkerStatus.Pending)

            let setWorkerStatus = 
                React.useCallback(setWorkerStatus)

            React.useEffectOnce(fun () ->
                worker.current <- Some (Worker.createHookWorker<'Arg, 'Result>(umdPath, setWorkerStatus, options))
                React.createDisposable(fun () -> worker.current.Value.Kill())
            )
            
            { exec = fun (args, callback) -> 
                  async {
                      let! res = worker.current.Value.Invoke(args)
                      do callback res
                  }
                  |> Async.StartImmediate
              kill = fun () -> (worker.current.Value.Kill())
              restart = fun () -> (worker.current.Value.Restart()) }
            , workerStatus
        /// Creates the worker process.
        static member inline useWorker<'Arg, 'Result> (umdPath: string) =
            React.useWorker<'Arg, 'Result>(umdPath, id)
            
namespace Elmish

open Feliz.UseWorker

[<RequireQualifiedAccess>]
module Cmd =
    type Worker =
        /// Creates the worker process.
        static member create (umdPath: string) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) : Cmd<_> =
            [ fun dispatch -> 
                Worker.create<'Arg,'Result>(umdPath, (workerStatusMsg >> dispatch))
                |> workerMsg
                |> dispatch ]

        /// Creates the worker process with additional options.
        static member createWithOptions (umdPath: string) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) (options: WorkerOptions -> WorkerOptions) : Cmd<_> =
            [ fun dispatch -> 
                Worker.createWithOptions<'Arg,'Result>(umdPath, (workerStatusMsg >> dispatch), options)
                |> workerMsg
                |> dispatch ]

        /// Executes the worker function.
        static member exec (worker: Worker<'Arg,'Result> option) (arg: 'Arg) (msg: 'Result -> 'Msg) : Cmd<_> =
            match worker with
            | Some worker -> Cmd.OfAsyncImmediate.perform worker.Invoke arg msg
            | None -> Cmd.none

        /// Terminates the worker instance.
        static member kill (worker: Worker<'Arg,'Result> option) : Cmd<_> =
            match worker with
            | Some worker -> [ fun _ -> worker.Kill() ]
            | None -> Cmd.none

        /// Terminates the worker instance (if alive), then generates a new worker.
        static member restart (worker: Worker<'Arg,'Result> option) : Cmd<_> =
            match worker with
            | Some worker -> [ fun _ -> worker.Restart() ]
            | None -> Cmd.none