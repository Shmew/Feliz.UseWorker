# Feliz.UseWorker [![Nuget](https://img.shields.io/nuget/v/Feliz.UseWorker.svg?maxAge=0&colorB=brightgreen)](https://www.nuget.org/packages/Feliz.UseWorker)

Web workers in Fable made easy, exposed as React hooks and Elmish commands.

Elmish:

```fs
open Feliz.UseWorker

type State =
    { Count: int 
      Worker: Worker<unit,int> option
      WorkerState: WorkerStatus }

type Msg =
    | ChangeWorkerState of WorkerStatus
    | ExecuteWorker
    | KillWorker
    | RestartWorker
    | SetWorker of Worker<unit,int>
    | WorkerResult of int

let init : State * Cmd<Msg> = 
    { Count = 0
      Worker = None
      WorkerState = WorkerStatus.Pending }
    , Cmd.Worker.create "Sort.sortNumbers" SetWorker ChangeWorkerState

let update (msg: Msg) (state: State) : State * Cmd<Msg> =
    match msg with
    | ChangeWorkerState workerState ->
        { state with WorkerState = workerState }, Cmd.none
    | ExecuteWorker ->
        state, Cmd.Worker.exec state.Worker () WorkerResult
    | KillWorker ->
        state, Cmd.Worker.kill state.Worker
    | RestartWorker ->
        state, Cmd.Worker.restart state.Worker
    | SetWorker worker ->
        { state with Worker = Some worker }, Cmd.none
    | WorkerResult i ->
        { state with Count = i }, Cmd.none
```

Hooks:

```fs
open Feliz.UseWorker

let render = React.functionComponent(fun () ->
    let worker,workerStatus = React.useWorker<unit, int>("Sort.sortNumbers")
    let count,setCount = React.useState 0

    Html.div [
        prop.children [
            ...
            Html.button [
                prop.onClick <| fun _ -> worker.invoke((), setCount) 
                prop.text "Execute function!"
            ]
            Html.button [
                prop.onClick <| fun _ -> worker.kill()
                prop.text "Kill"
            ]
            Html.button [
                prop.onClick <| fun _ -> worker.restart()
                prop.text "Restart"
            ]
        ]
    ])
```
