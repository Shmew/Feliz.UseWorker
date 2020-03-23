[<RequireQualifiedAccess>]
module Samples.Basic

open Elmish
open Feliz
open Feliz.ElmishComponents
open Zanaptak.TypedCssClasses

type Bulma = CssClasses<"https://cdnjs.cloudflare.com/ajax/libs/bulma/0.7.5/css/bulma.min.css", Naming.PascalCase>
type FA = CssClasses<"https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", Naming.PascalCase>

let rng = System.Random()

let inline sortNumbers () =
    Array.init 50000 (fun _ -> rng.NextDouble() * 1000000.)
    |> Array.sum
    |> int

//let render = React.functionComponent(fun () ->
//    let f,status,kill = React.useWorker sortNumbers

//    Html.div [
//        prop.className Bulma.Control
//        prop.style [
//            style.paddingLeft (length.em 8)
//            style.paddingBottom (length.em 1)
//        ]
//        prop.children [
//            Html.div [
//                prop.style [ style.maxWidth (length.em 15); style.paddingBottom (length.em 2) ]
//                prop.children [
//                    Html.div [
//                        prop.style [
//                            style.textAlign.center
//                            style.marginLeft length.auto
//                            style.marginRight length.auto
//                            style.marginTop 50
//                            style.paddingBottom (length.em 2)
//                        ]
//                        prop.children [
//                            Html.li [
//                                prop.className [
//                                    FA.Fa
//                                    FA.FaRefresh
//                                    FA.FaSpin
//                                    FA.Fa3X
//                                ]
//                            ]
//                        ]
//                    ]
//                    Html.div [
//                        prop.classes [ Bulma.Box ]
//                        prop.children [
//                            Html.div [
//                                prop.text (sprintf "Worker Status: %s"(status.ToString()))
//                            ]
//                        ]
//                    ]
//                ]
//            ]
//            Html.button [
//                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
//                prop.onClick <| fun _ -> f() |> Promise.start
//                prop.text "Execute function!"
//            ]
//            Html.button [
//                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
//                prop.onClick <| fun _ -> kill()
//                prop.text "Kill"
//            ]
//        ]
//    ])

open WorkerTest.WorkerImpl
open Fable.Core

type State = 
    { Count: int 
      WorkerState: WorkerStatus }

[<Emit("console.log($0)")>]
let log x = jsNative

let addOne i = 1 + i

let originUrl () =
    Browser.Dom.document.location.origin

let dynamicImport () =
    Browser.Dom.document.getElementsByTagName("script").[2].getAttribute("src")

let worker = new Worker<int,int>((fun _ -> sortNumbers()), [| sprintf "%s/%s" (originUrl()) (dynamicImport()) |])

type Msg =
    | ChangeWorkerState of WorkerStatus
    | ExecuteWorker
    | GetWorkerState
    | KillWorker
    | WorkerResult of int

let statusSub =
    let sub dispatch =
        JS.setInterval (fun _ -> dispatch GetWorkerState) 1000 |> ignore

    Cmd.ofSub sub

let init : State * Cmd<Msg> = { Count = 0; WorkerState = WorkerStatus.Pending }, statusSub

let update (msg: Msg) (state: State) : State * Cmd<Msg> =
    match msg with
    | ChangeWorkerState workerState ->
        { state with WorkerState = workerState }, Cmd.none
    | ExecuteWorker ->
        state, Cmd.OfAsyncImmediate.perform (fun () -> worker.Invoke(state.Count)) () WorkerResult
    | GetWorkerState ->
        state, Cmd.OfAsyncImmediate.perform (fun () -> worker.GetState()) () ChangeWorkerState
    | KillWorker ->
        state, Cmd.OfAsyncImmediate.perform (fun () -> worker.KillWorker()) () ChangeWorkerState
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
                prop.onClick <| fun _ -> dispatch ExecuteWorker
                prop.text "Execute function!"
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.onClick <| fun _ -> dispatch KillWorker
                prop.text "Kill"
            ]
        ]
    ]
    

let render () = React.elmishComponent("Counter", init, update, render')