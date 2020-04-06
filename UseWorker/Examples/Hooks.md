# Feliz.UseWorker - React Hooks Example

```fsharp:useworker-hooks
[<RequireQualifiedAccess>]
module Samples.Hooks

open Elmish
open Feliz
open Feliz.UseWorker
open Zanaptak.TypedCssClasses

type Bulma = CssClasses<"https://cdnjs.cloudflare.com/ajax/libs/bulma/0.7.5/css/bulma.min.css", Naming.PascalCase>
type FA = CssClasses<"https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", Naming.PascalCase>

let render = React.functionComponent(fun () ->
    let worker,workerStatus = React.useWorker<unit, int>("Sort.sortNumbers")
    let count,setCount = React.useState 0

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
                        prop.children [ FPSStats.render() ]
                    ]
                    Html.div [
                        prop.classes [ Bulma.Box ]
                        prop.children [
                            Html.div [
                                prop.text (sprintf "Worker Status: %s" (workerStatus.ToString()))
                            ]
                            Html.div [
                                prop.text (sprintf "Count: %i" count)
                            ]
                        ]
                    ]
                ]
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.disabled (match workerStatus with | WorkerStatus.Running | WorkerStatus.Killed -> true | _ -> false)
                prop.onClick <| fun _ -> worker.exec((), setCount) 
                prop.text "Execute"
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.disabled (match workerStatus with | WorkerStatus.Killed -> true | _ -> false)
                prop.onClick <| fun _ -> worker.kill()
                prop.text "Kill"
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.onClick <| fun _ -> worker.restart()
                prop.text "Restart"
            ]
            Html.button [
                prop.classes [ Bulma.Button; Bulma.HasBackgroundPrimary; Bulma.HasTextWhite ]
                prop.onClick <| fun _ -> (Workers.Sort.sortNumbers() |> setCount)
                prop.text "Execute - Non worker"
            ]
        ]
    ])
```