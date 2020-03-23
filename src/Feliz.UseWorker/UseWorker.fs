namespace Feliz

open Fable.Core.JsInterop
open Feliz
open Feliz.UseWorker

[<AutoOpen>]
module Hooks =
    type React with
        static member inline useWorker (f: 'T -> 'R) =
            Bindings.useWorker f |> Bindings.tuple3FromArray<'T,'R>
        static member inline useWorker (timeout: int, (f: 'T -> 'R)) =
            Bindings.useWorkerWithOpts f (createObj !![ "timeout" ==> timeout ])
            |> Bindings.tuple3FromArray<'T,'R>
        static member inline useWorker ((f: 'T -> 'R), (deps: 'a [])) =
            Bindings.useWorkerWithOpts f (createObj !! [ "dependencies" ==> (ResizeArray deps) ])
            |> Bindings.tuple3FromArray<'T,'R>
        static member inline useWorker (timeout: int, (f: 'T -> 'R), (deps: 'a [])) =
            Bindings.useWorkerWithOpts f (createObj !! [ "timeout" ==> timeout; "dependencies" ==> (ResizeArray deps) ])
            |> Bindings.tuple3FromArray<'T,'R>

namespace WorkerTest

module WorkerImpl =
    open Browser.Blob
    open Browser.Types
    open Fable.Core
    open Fable.Core.JsInterop

    type Message<'a> =
      | Enqueue of 'a
      | Dequeue of (seq<'a> -> unit)

    /// The status of a web worker instance.
    [<RequireQualifiedAccess>]
    type WorkerStatus =
        /// The web worker has been initialized, but has not yet been executed.
        | Pending
        /// The web worker has been executed correctly.
        | Success
        /// The web worker is running.
        | Running
        /// The web worker ended with an error.
        | Error
        /// The web worker was killed via timeout expiration.
        | TimeoutExpired
        /// The web worker process has been terminated.
        | Killed

    let inline depsParser (deps: string []) =
        match deps with
        | [||] -> None
        | _ ->
            deps
            |> String.concat ", "
            |> sprintf "importScripts('%s'); "
            |> Some

    let [<Global>] URL : obj = jsNative
    
    let inline originUrl () =
        Browser.Dom.document.location.origin

    let inline dynamicImport () =
        Browser.Dom.document.getElementsByTagName("script").[2].getAttribute("src")

    [<Emit("$0.bind({})")>]
    let jobRunnerFun f = jsNative 
    
    [<Emit("$0.toString()")>]
    let funToString f : string = jsNative

    [<Emit("postMessage($0)")>]
    let postMessage a = jsNative

    [<Emit("importScripts($0)")>]
    let importScripts s = jsNative

    let inline createWorkerBlobUrl f depArr jobRunner =
        let onMessage = sprintf "onmessage=(%s)(%s)" (funToString jobRunner) (funToString f)
        
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

    type private MailboxMessage<'Arg,'Result> =
        | RunFunction of 'Arg * AsyncReplyChannel<'Result>
        | WorkerResult of 'Result
        | Status of WorkerStatus
        | GetStatus of AsyncReplyChannel<WorkerStatus>
        | Kill

    let importString () = sprintf "%s/%s" (originUrl()) (dynamicImport())

    type Worker<'Arg,'Result> (f: 'Arg -> 'Result, deps: string []) =
        let worker = newWorker (createWorkerBlobUrl f deps (fun f (e: MessageEvent) -> postMessage(f e.data)))
        
        let mailbox =
            MailboxProcessor.Start <| fun inbox ->
                let rec loop (resultReplyChannel: AsyncReplyChannel<_> option, workerState: WorkerStatus) =
                    async {
                        let! msg = inbox.Receive()

                        match msg with
                        | RunFunction (arg, replyChannel) ->
                            worker.postMessage arg
                            return! loop (Some replyChannel, WorkerStatus.Running)
                        | Status result ->
                                return! loop (resultReplyChannel, result)
                        | GetStatus replyChannel ->
                            replyChannel.Reply workerState
                            return! loop (resultReplyChannel, workerState)
                        | WorkerResult result ->
                            if resultReplyChannel.IsSome then
                                resultReplyChannel.Value.Reply result
                            return! loop (None, WorkerStatus.Success)
                        | Kill -> 
                            worker.terminate()
                            return! loop (None, WorkerStatus.Killed)
                    }

                loop (None, WorkerStatus.Pending)
        
        do
            worker.onerror <- fun _ -> mailbox.Post (Status WorkerStatus.Error)
            worker.onmessage <- fun msg -> mailbox.Post (WorkerResult (unbox<'Result> msg.data))

        interface System.IDisposable with
            member _.Dispose () = worker.terminate()

        member _.Invoke (arg: 'Arg) : Async<'Result> =
            mailbox.PostAndAsyncReply(fun reply -> RunFunction(arg, reply))

        member _.GetState () =
            mailbox.PostAndAsyncReply(fun reply -> GetStatus(reply))

        member _.KillWorker () =
            mailbox.Post Kill
            mailbox.PostAndAsyncReply(fun reply -> GetStatus(reply))
