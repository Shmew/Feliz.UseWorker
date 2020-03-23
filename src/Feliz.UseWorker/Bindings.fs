namespace Feliz.UseWorker

open Fable.Core
open Fable.Core.JsInterop

[<RequireQualifiedAccess>]
module Bindings =
    type WebWorkerOptions =
        abstract timeout: int option with get
        abstract dependencies: obj [] option with get

    let useWorker f : obj [] = import "useWorker" "@koale/useworker"
    let useWorkerWithOpts f opts : obj [] = import "useWorker" "@koale/useworker"

    let tuple3FromArray<'T,'R> (arr: obj []) =
        (unbox<'T -> JS.Promise<'R>> arr.[0], unbox<Feliz.WorkerStatus> arr.[1], unbox<unit -> unit> arr.[2])
