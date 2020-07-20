namespace Feliz.UseWorker

open Feliz

[<AutoOpen>]
module Hook =
    type WorkerCommands<'Arg,'Result> =
        { /// Executes the worker function.
          exec: ('Arg * ('Result -> unit)) -> unit
          /// Terminates the worker instance.
          kill: unit -> unit
          /// Terminates the worker instance (if alive), then generates a new worker.
          restart: unit -> unit }

    type React with
        /// Creates the worker process.
        static member inline useWorker (workerFunc: WorkerFunc<'Arg,'Result>, options: WorkerOptions -> WorkerOptions) =
            let ct = React.useCancellationToken()
            let worker : Fable.React.IRefValue<Worker<'Arg, 'Result> option> = React.useRef(None)
            let workerStatus, setWorkerStatus = React.useState(WorkerStatus.Pending)
            let options = React.useMemo((fun () -> WorkerOptions.Defaults |> options), [| options :> obj |])

            React.useEffect((fun () -> 
                Option.iter (fun token ->
                    ct.current <- token
                ) options.CancellationToken
            ), [| options.CancellationToken :> obj |])

            let setWorkerStatus = 
                React.useCallbackRef(fun status -> 
                    if not ct.current.IsCancellationRequested then
                        setWorkerStatus status
                )

            React.useEffectOnce(fun () ->
                worker.current <- Some (Worker<'Arg,'Result>.CreateHook(workerFunc, setWorkerStatus, options))
                React.createDisposable(fun () -> worker.current.Value.Kill())
            )
            
            { exec = fun (args, callback) -> 
                  async {
                      let! res = worker.current.Value.Invoke(args)
                      do callback res
                  }
                  |> fun a -> Async.StartImmediate(a, ct.current)
              kill = fun () -> 
                async {
                    if not ct.current.IsCancellationRequested then
                        worker.current.Value.Kill()
                }
                |> fun a -> Async.StartImmediate(a, ct.current)

              restart = fun () ->
                async {
                    if not ct.current.IsCancellationRequested then
                        worker.current.Value.Restart()
                }
                |> fun a -> Async.StartImmediate(a, ct.current) }
            , workerStatus

        /// Creates the worker process.
        static member inline useWorker (workerFunc: WorkerFunc<'Arg,'Result>) =
            React.useWorker(workerFunc, id)
