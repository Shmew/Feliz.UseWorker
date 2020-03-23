[<RequireQualifiedAccess>]
module Samples.ElmishFunctional

open Elmish
open Feliz
open Zanaptak.TypedCssClasses

type Bulma = CssClasses<"https://cdnjs.cloudflare.com/ajax/libs/bulma/0.7.5/css/bulma.min.css", Naming.PascalCase>
type FA = CssClasses<"https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css", Naming.PascalCase>

[<AutoOpen>]
module ElmishComponentTest =
    [<Struct>]
    type internal RingState<'item> =
        | Writable of wx:'item array * ix:int
        | ReadWritable of rw:'item array * wix:int * rix:int
    
    type internal RingBuffer<'item>(size) =
        let doubleSize ix (items: 'item array) =
            seq { yield! items |> Seq.skip ix
                  yield! items |> Seq.take ix
                  for _ in 0..items.Length do
                    yield Unchecked.defaultof<'item> }
            |> Array.ofSeq
    
        let mutable state : 'item RingState =
            Writable (Array.zeroCreate (max size 10), 0)
    
        member __.Pop() =
            match state with
            | ReadWritable (items, wix, rix) ->
                let rix' = (rix + 1) % items.Length
                match rix' = wix with
                | true -> 
                    state <- Writable(items, wix)
                | _ ->
                    state <- ReadWritable(items, wix, rix')
                Some items.[rix]
            | _ ->
                None
    
        member __.Push (item:'item) =
            match state with
            | Writable (items, ix) ->
                items.[ix] <- item
                let wix = (ix + 1) % items.Length
                state <- ReadWritable(items, wix, ix)
            | ReadWritable (items, wix, rix) ->
                items.[wix] <- item
                let wix' = (wix + 1) % items.Length
                match wix' = rix with
                | true -> 
                    state <- ReadWritable(items |> doubleSize rix, items.Length, 0)
                | _ -> 
                    state <- ReadWritable(items, wix', rix)

    type ElmishComponentProps<'State, 'Msg> = {
        Initial : 'State * Cmd<'Msg>
        Update : 'Msg -> 'State -> 'State * Cmd<'Msg>
        Render : 'State -> ('Msg -> unit) -> ReactElement
        key : string
    }
    type Ref<'T> =
        abstract current: 'T with get, set
        
    type IReactApiTest =
        inherit Feliz.ReactApi.IReactApi
        abstract useRef : 'T -> Ref<'T>

    open Fable.Core.JsInterop

    let reactApi : IReactApiTest = importDefault "react"

    type React with
        static member inline useRef (value: 'T) : Ref<'T> = reactApi.useRef value

    let elmishComponent<'State,'Msg> = React.memo(fun (input: ElmishComponentProps<'State,'Msg>) ->
        let state = React.useRef(fst input.Initial)
        let childState, setChildState = React.useState(fst input.Initial)
        let ring = React.useRef(RingBuffer(10))
        let reentered = React.useRef(false)

        let rec dispatch (msg: 'Msg) =
            promise {
                if reentered.current then
                    ring.current.Push msg
                else
                    reentered.current <- false
                    let mutable nextMsg = Some msg

                    while nextMsg.IsSome do
                        let msg = nextMsg.Value
                        let (state', cmd') = input.Update msg state.current
                        cmd' |> List.iter (fun sub -> sub dispatch)
                        nextMsg <- ring.current.Pop()
                        state.current <- state'
                        setChildState state.current
                    reentered.current <- false
            }
            |> Promise.start

        let dispatch = React.useCallback dispatch

        React.useEffect(fun () -> 
            match ring.current.Pop() with
            | Some sub -> dispatch sub
            | None -> ())

        input.Render childState dispatch)

    type React with
        /// Creates a standalone React component using an Elmish dispatch loop
        static member inline elmishComponent(name, init, update, render, ?key) =
            let fullKey =
                match key with
                | None -> name
                | Some key -> name + "-" + key
            elmishComponent { Initial = init; Update = update; Render = render; key = fullKey }

        /// Creates a standalone React component using an Elmish dispatch loop
        static member inline elmishComponent(name, init, update, render, ?key) =
            let fullKey =
                match key with
                | None -> name
                | Some key -> name + "-" + key
            elmishComponent { Initial = init, Cmd.none; Update = update; Render = render; key = fullKey }
    
        /// Creates a standalone React component using an Elmish dispatch loop
        static member inline elmishComponent(name, init, update, render, ?key) =
            let fullKey =
                match key with
                | None -> name
                | Some key -> name + "-" + key
            elmishComponent
                { Initial = init, Cmd.none;
                  Update = fun msg state -> update msg state, Cmd.none;
                  Render = render
                  key = fullKey }
    
        /// Creates a standalone React component using an Elmish dispatch loop
        static member inline elmishComponent(name, init, update, render, ?key) =
            let fullKey =
                match key with
                | None -> name
                | Some key -> name + "-" + key
            elmishComponent
                { Initial = init;
                  Update = fun msg state -> update msg state, Cmd.none;
                  Render = render
                  key = fullKey }

type State = { Count: int }

type Msg =
    | Increment
    | Decrement
    | IncrementIndirect
    | IncrementTwice
    | IncrementDelayed
    | IncrementTwiceDelayed

let init : State * Cmd<Msg> = { Count = 0 }, Cmd.none

let update (msg: Msg) (state: State) : State * Cmd<Msg> =
    match msg with
    | Increment ->
        { state with Count = state.Count + 1 }, Cmd.ofSub (fun dispatch -> printfn "Increment")

    | Decrement ->
        { state with Count = state.Count - 1 }, Cmd.ofSub (fun dispatch -> printfn "Decrement")

    | IncrementIndirect ->
        state, Cmd.ofMsg Increment

    | IncrementTwice ->
        state, Cmd.batch [ Cmd.ofMsg Increment; Cmd.ofMsg Increment ]

    | IncrementDelayed ->
        state, Cmd.OfAsyncImmediate.perform (fun () ->
            async {
                do! Async.Sleep 1000;
                return IncrementIndirect
            }) () (fun msg -> msg)

    | IncrementTwiceDelayed ->
        state, Cmd.batch [ Cmd.ofMsg IncrementDelayed; Cmd.ofMsg IncrementDelayed ]

let render state dispatch =
    Html.div [
        Html.button [
            prop.onClick (fun _ -> dispatch Increment)
            prop.text "Increment"
        ]

        Html.button [
            prop.onClick (fun _ -> dispatch Decrement)
            prop.text "Decrement"
        ]

        Html.button [
            prop.onClick (fun _ -> dispatch IncrementIndirect)
            prop.text "IncrementIndirect"
        ]

        Html.button [
            prop.onClick (fun _ -> dispatch IncrementDelayed)
            prop.text "IncrementDelayed"
        ]

        Html.button [
            prop.onClick (fun _ -> dispatch IncrementTwice)
            prop.text "Increment Twice"
        ]

        Html.button [
            prop.onClick (fun _ -> dispatch IncrementTwiceDelayed)
            prop.text "IncrementTwiceDelayed"
        ]

        Html.h1 state.Count
    ]

let elmishComp () = React.elmishComponent("Counter", init, update, render)
