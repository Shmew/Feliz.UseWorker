# Feliz.UseWorker - Elmish Example

```fsharp:useworker-elmish
[<RequireQualifiedAccess>]
module Samples.Elmish

open Elmish
open Fable.Core
open Feliz
open Feliz.UseWorker
open Feliz.ElmishComponents
open Zanaptak.TypedCssClasses

type Bulma = CssClasses<"https://cdnjs.cloudflare.com/ajax/libs/bulma/0.7.5/css/bulma.min.css", Naming.PascalCase>
type FA = CssClasses<"https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", Naming.PascalCase>

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

let render' state dispatch =
    Html.div [
        prop.className Bulma.Control
        prop.style [
            style.paddingLeft (length.em 8)
            style.paddingBottom (length.em 1)
        ]
        prop.children [
            Html.div [
                prop.style [ style.maxWidth (length.em 15); style.paddingBottom (length.em 2) ]
                prop.children [
                    Html.div [
                        prop.style [
                            style.textAlign.center
                            style.marginLeft length.auto
                            style.marginRight length.auto
                            style.marginTop 50
                            style.paddingBottom (length.em 2)
                        ]
                        prop.children [
                            Html.li [
                                prop.className [
                                    FA.Fa
                                    FA.FaRefresh
                                    FA.FaSpin
                                    FA.Fa3X
                                ]
                            ]
                        ]
                    ]
                    Html.div [
                        prop.classes [ Bulma.Box ]
                        prop.children [
                            Html.div [
                                prop.text (sprintf "Worker Status: %s" (state.WorkerState.ToString()))
                            ]
                            Html.div [
                                prop.text (sprintf "Count: %i" state.Count)
                            ]
                        ]
                    ]
                ]
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.disabled (match state.WorkerState with | WorkerStatus.Running | WorkerStatus.Killed -> true | _ -> false)
                prop.onClick <| fun _ -> dispatch ExecuteWorker
                prop.text "Execute function!"
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.disabled (match state.WorkerState with | WorkerStatus.Killed -> true | _ -> false)
                prop.onClick <| fun _ -> dispatch KillWorker
                prop.text "Kill"
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.onClick <| fun _ -> dispatch RestartWorker
                prop.text "Restart"
            ]
        ]
    ]
    

let render () = React.elmishComponent("Counter", init, update, render')
```