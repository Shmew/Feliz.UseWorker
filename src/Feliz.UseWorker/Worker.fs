namespace Feliz.UseWorker

open Browser.Blob
open Browser.Dom
open Browser.Types
open Fable.Core
open Fable.Core.JsInterop
open Fable.SimpleJson
open System.ComponentModel

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
    | Error of string
    /// The worker was killed via timeout expiration.
    | TimeoutExpired
    /// The worker process has been terminated.
    | Killed

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
      
      /// Execute the function on the main thread if execution is
      /// request when the worker is in a failed state.
      ///
      /// Default: true
      Fallback: bool

      /// Timeout of worker function in ms.
      ///
      /// Default: `Some 5000`
      Timeout: int option }

    /// Converts the umdPath and options into a list of dependencies for usage in the worker via importScripts
    member internal this.CreateDeps (umdPath: string) =
        sprintf "%s/%s.js"
            this.BasePath
            umdPath
        |> fun workerPath ->
            workerPath::this.Dependencies
            |> Array.ofList

    static member internal Defaults =
        { BasePath = 
            document.location.href.Split('#') 
            |> Array.tryHead
            |> function
            | Some url -> url.Remove(url.Length-1)
            | None -> document.location.origin
            |> sprintf "%s/Workers"
          Fallback = true
          Dependencies = []
          Timeout = Some 5000 }

[<EditorBrowsable(EditorBrowsableState.Never)>]
module Internals =
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
    let inline createWorkerBlobUrl umdPath name depArr jobRunner =
        let onMessage = 
            sprintf "onmessage=(%s)(%s)" 
                (funToString jobRunner) 
                (sprintf "(function (args) { return %s.%s.WorkerFunction(args) })" umdPath name)
    
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

    [<Emit("setTimeout($0, $1)")>]
    let setTimeout (f: unit -> unit) (timeout: int) : int = jsNative

    [<Emit("clearTimeout($0)")>]
    let clearTimeout (id: int) : unit = jsNative

    type MailboxMessage<'Arg,'Result> =
        | Kill
        | Restart of Worker
        | RunFunction of 'Arg * AsyncReplyChannel<'Result>
        | SetStatus of WorkerStatus
        | WorkerResult of 'Result

    type MailboxState<'T> =
        { ResultReplyChannel: AsyncReplyChannel<'T> option
          TimeoutId: int option
          WorkerState: WorkerStatus
          Worker: Worker }

    [<RequireQualifiedAccess>]
    type WorkerSubscriberState =
        | Status of WorkerStatus
        | Kill

    type WorkerSubscriberMailbox (dispatch: WorkerStatus -> unit) =
        let mailbox =
            MailboxProcessor.Start <| fun inbox ->
                let rec loop () =
                    async {
                        let! msg = inbox.Receive()

                        return!
                            match msg with
                            | WorkerSubscriberState.Status status ->
                                dispatch status
                                loop ()
                            | WorkerSubscriberState.Kill -> async { return () }
                    }

                loop ()

        member _.Kill () =
            mailbox.Post WorkerSubscriberState.Kill

        member _.PostStatus (status: WorkerStatus) =
            mailbox.Post(WorkerSubscriberState.Status status)

    type WorkerSubscriber =
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

    let inline applyWorkerCommands (worker: Worker) (mailbox: MailboxProcessor<MailboxMessage<'Arg,'Result>>) (decoder: string -> Result<'Result,string>) =
        worker.onerror <- fun e -> mailbox.Post (SetStatus (WorkerStatus.Error ((unbox<ErrorEvent> e).message)))
        worker.onmessage <- fun msg ->            
            match decoder (string msg.data) with
            | Ok rsp -> mailbox.Post (WorkerResult rsp)
            | Error e -> mailbox.Post (SetStatus (WorkerStatus.Error e))

    let isPrimitive (type': System.Type) =
        match type'.FullName with
        | _ as this when this.Contains("FSharp.Core.Unit") -> true
        | "System.Char"
        | "System.String"
        | "System.Boolean"
        | "System.SByte"
        | "System.Byte"
        | "System.Int16"
        | "System.UInt16"
        | "System.Int32"
        | "System.UInt32"
        | "System.Single"
        | "System.Double"
        | "System.Decimal" -> true
        | _ -> false

open Internals

type WorkerArgCoders<'Arg> =
    { /// Deserialization function for worker json input.
      ///
      /// Default: Fable.SimpleJson.Json.tryParseAs<'Result>
      Decoder: string -> 'Arg

      /// Serialization function for worker json input.
      ///
      /// Default: fun (arg: 'Arg) -> Fable.SimpleJson.SimpleJson.stringify arg
      Encoder: 'Arg -> string }

    static member inline Defaults =
        { Decoder = Json.parseAs<'Arg>
          Encoder = fun (arg: 'Arg) -> SimpleJson.stringify arg }

type WorkerResultCoders<'Result> =
    { /// Deserialization function for worker json response.
      ///
      /// Default: Fable.SimpleJson.Json.tryParseAs<'Result>
      Decoder: string -> Result<'Result,string>

      /// Serialization function for worker json response.
      ///
      /// Default: fun (arg: 'Result) -> Fable.SimpleJson.SimpleJson.stringify arg
      Encoder: 'Result -> string }

    static member inline Defaults =
        { Decoder = Json.tryParseAs<'Result>
          Encoder = fun (arg: 'Result) -> SimpleJson.stringify arg }

type WorkerFunc<'Arg,'Result> =
    { /// Worker de/serialization functions.
      ArgCoders: WorkerArgCoders<'Arg> option
      /// Inner worker function.
      Function: 'Arg -> 'Result
      /// Name of the binding of the WorkerFunc.
      Name: string
      /// Worker de/serialization functions.
      ResultCoders: WorkerResultCoders<'Result> option
      /// The wrapped worker function.
      WorkerFunction: obj -> obj
      /// UMD module path.
      UmdPath: string }
  
    /// Invoke the inner function in the main thread.
    member this.InvokeSync = this.Function

    member internal this.DecodeArg (input: string) =
        match this.ArgCoders with
        | Some argCoder -> argCoder.Decoder input
        | None -> unbox<'Arg> input

    member internal this.DecodeResult (input: string) =
        match this.ResultCoders with
        | Some resultCoder -> resultCoder.Decoder input
        | None -> Ok (unbox<'Result> input)

    member internal this.Encode (arg: 'Arg) =
        match this.ArgCoders with
        | Some argCoder -> box (argCoder.Encoder arg)
        | None -> box arg
    member internal this.Encode (arg: 'Result) =
        match this.ResultCoders with
        | Some resultCoder -> box (resultCoder.Encoder arg)
        | None -> box arg

    /// Create a function to run inside a worker instance.
    static member inline Create (umdPath: string,
                                 name: string,
                                 f: 'Arg -> 'Result,
                                 ?argCoder: WorkerArgCoders<'Arg> -> WorkerArgCoders<'Arg>,
                                 ?resultCoder: WorkerResultCoders<'Result> -> WorkerResultCoders<'Result>) =

        let argCoder =
            match argCoder with
            | Some coders -> Some (coders WorkerArgCoders<'Arg>.Defaults)
            | None when not (isPrimitive typeof<'Arg>) -> Some WorkerArgCoders<'Arg>.Defaults
            | _ -> None

        let resultCoder =
            match resultCoder with
            | Some coders -> Some (coders WorkerResultCoders<'Result>.Defaults)
            | None when not (isPrimitive typeof<'Result>) -> Some WorkerResultCoders<'Result>.Defaults
            | _ -> None

        { ArgCoders = argCoder
          Function = f
          Name = name
          ResultCoders = resultCoder
          WorkerFunction =
            match argCoder, resultCoder with
            | Some argCoder, Some resultCoder ->
                unbox<string> >> argCoder.Decoder >> f >> resultCoder.Encoder >> box
            | Some argCoder, None ->
                unbox<string> >> argCoder.Decoder >> f >> box
            | None, Some resultCoder ->
                unbox<'Arg> >> f >> resultCoder.Encoder >> box
            | None, None -> unbox<'Arg> >> f >> box
          UmdPath = umdPath }

type Worker<'Arg,'Result> private (workerFun: WorkerFunc<'Arg,'Result>, subscriber: WorkerSubscriber, options: WorkerOptions) =
    let deps = options.CreateDeps workerFun.UmdPath

    let createNewWorker () = 
        newWorker (createWorkerBlobUrl workerFun.UmdPath workerFun.Name deps (fun f (e: MessageEvent) -> postMessage(f e.data)))

    let timeout = Option.defaultValue System.Int32.MaxValue options.Timeout
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
                                match state.WorkerState with
                                | WorkerStatus.Error _ when options.Fallback ->
                                    workerFun.Function arg
                                    |> replyChannel.Reply

                                    state
                                | _ ->
                                    state.Worker.postMessage (workerFun.Encode arg)

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
        
        do applyWorkerCommands worker mailbox workerFun.DecodeResult

        mailbox

    let mailbox = createMailbox(createNewWorker())

    interface System.IDisposable with
        member _.Dispose () = 
            mailbox.Post Kill
            token.Cancel()
            token.Dispose()
            subscriber.Kill()

    /// Disposes the worker and all resources related to it.
    member this.Dispose() = (this :> System.IDisposable).Dispose()

    [<EditorBrowsable(EditorBrowsableState.Never)>]
    member _.Invoke (arg: 'Arg) =
        mailbox.PostAndAsyncReply(fun reply -> RunFunction(arg, reply))
         
    [<EditorBrowsable(EditorBrowsableState.Never)>]
    member _.Kill () =
        mailbox.Post Kill

    [<EditorBrowsable(EditorBrowsableState.Never)>]
    member _.Restart () =
        let worker = createNewWorker()
        do applyWorkerCommands worker mailbox workerFun.DecodeResult

        mailbox.Post(Restart worker)

    /// Creates the mailbox processer with subscriber for elmish usage.
    [<EditorBrowsable(EditorBrowsableState.Never)>]
    static member CreateElmish (workerFun: WorkerFunc<'Arg,'Result>, dispatch: WorkerStatus -> unit, ?options: WorkerOptions -> WorkerOptions) =
        let workerSub = WorkerSubscriber.Elmish(new WorkerSubscriberMailbox(dispatch))
        let options = WorkerOptions.Defaults |> Option.defaultValue id options

        new Worker<'Arg,'Result>(workerFun, workerSub, options)

    /// Creates the mailbox processer and subscriber (callback) for the react hook.
    [<EditorBrowsable(EditorBrowsableState.Never)>]
    static member CreateHook (workerFun: WorkerFunc<'Arg,'Result>, dispatch: WorkerStatus -> unit, ?options: WorkerOptions -> WorkerOptions) =
        let workerSub = WorkerSubscriber.Hook(dispatch)
        let options = WorkerOptions.Defaults |> Option.defaultValue id options

        new Worker<'Arg,'Result>(workerFun, workerSub, options)
