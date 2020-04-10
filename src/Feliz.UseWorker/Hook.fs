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
            let worker : Fable.React.IRefValue<Worker<'Arg, 'Result> option> = React.useRef(None)
            let workerStatus, setWorkerStatus = React.useState(WorkerStatus.Pending)

            let setWorkerStatus = 
                React.useCallback(setWorkerStatus)

            React.useEffectOnce(fun () ->
                worker.current <- Some (Worker<'Arg,'Result>.CreateHook(workerFunc, setWorkerStatus, options))
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
        static member inline useWorker (workerFunc: WorkerFunc<'Arg,'Result>) =
            React.useWorker(workerFunc, id)
