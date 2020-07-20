namespace Elmish

open Feliz.UseWorker

[<RequireQualifiedAccess>]
module Cmd =
    type Worker =
        /// Creates the worker process.
        static member inline create (workerFunc: WorkerFunc<'Arg,'Result>) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) : Cmd<_> =
            [ fun dispatch ->
                Worker<'Arg,'Result>.CreateElmish(workerFunc, (workerStatusMsg >> dispatch), WorkerOptions.Defaults)
                |> workerMsg
                |> dispatch ]

        /// Creates the worker process with additional options.
        static member inline createWithOptions (workerFunc: WorkerFunc<'Arg,'Result>) (workerMsg: Worker<_,_> -> 'Msg) (workerStatusMsg: WorkerStatus -> 'Msg) (options: WorkerOptions -> WorkerOptions) : Cmd<_> =
            [ fun dispatch ->
                let options = WorkerOptions.Defaults |> options
                Worker<'Arg,'Result>.CreateElmish(workerFunc, (workerStatusMsg >> dispatch), options)
                |> workerMsg
                |> fun newMsg ->
                    match options.CancellationToken with
                    | Some ct ->
                        if not ct.IsCancellationRequested then
                            dispatch newMsg
                    | None -> dispatch newMsg ]

        /// Executes the worker function.
        static member inline exec (worker: Worker<'Arg,'Result> option) (arg: 'Arg) (msg: 'Result -> 'Msg) : Cmd<_> =
            match worker with
            | Some worker when worker.Options.CancellationToken.IsSome ->
                [ fun dispatch ->
                    async {
                        try
                            let! res = worker.Invoke arg
                            dispatch (msg res)
                        with _ -> ()
                    }
                    |> fun a -> Async.StartImmediate(a, worker.Options.CancellationToken.Value) ]
            | Some worker -> Cmd.OfAsyncImmediate.perform worker.Invoke arg msg
            | None -> Cmd.none

        /// Terminates the worker instance.
        static member inline kill (worker: Worker<'Arg,'Result> option) : Cmd<_> =
            match worker with
            | Some worker when worker.Options.CancellationToken.IsSome ->
                [ fun _ ->
                    async {
                        try
                            worker.Kill()
                        with _ -> ()
                    }
                    |> fun a -> Async.StartImmediate(a, worker.Options.CancellationToken.Value) ]
            | Some worker -> 
                [ fun _ -> try worker.Kill() with _ -> () ]
            | None -> Cmd.none

        /// Terminates the worker instance (if alive), then generates a new worker.
        static member inline restart (worker: Worker<'Arg,'Result> option) : Cmd<_> =
            match worker with
            | Some worker -> [ fun _ -> try worker.Restart() with _ -> () ]
            | None -> Cmd.none
