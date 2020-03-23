# Feliz.UseWorker - Elmish Example

```fsharp:useworker-elmish
[<RequireQualifiedAccess>]
module Samples.Basic

open Feliz
open Zanaptak.TypedCssClasses

type Bulma = CssClasses<"https://cdnjs.cloudflare.com/ajax/libs/bulma/0.7.5/css/bulma.min.css", Naming.PascalCase>
type FA = CssClasses<"https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", Naming.PascalCase>

let render = React.functionComponent(fun () ->
    let divText, setDivText = React.useState ""
    let f,status,kill = React.useWorker(fun () -> "howdy!")

    Html.div [
        prop.className Bulma.Control
        prop.style [
            style.paddingLeft (length.em 8)
            style.paddingBottom (length.em 1)
        ]
        prop.children [
            Html.div [
                prop.text divText
            ]
            Html.div [
                prop.text (status.ToString())
            ]
            Html.button [
                prop.classes [ Bulma.Button ]
                prop.onClick <| fun _ -> f() |> Promise.map setDivText |> Promise.start
                prop.text "Execute function!"
            ]
        ]
    ])
```