namespace Feliz

open Fable.Core

/// The status of a web worker instance.
[<RequireQualifiedAccess>]
[<StringEnum>]
type WorkerStatus =
    /// The web worker has been initialized, but has not yet been executed.
    | [<CompiledName "PENDING">] Pending
    /// The web worker has been executed correctly.
    | [<CompiledName "SUCCESS">] Success
    /// The web worker is running.
    | [<CompiledName "RUNNING">] Running
    /// The web worker ended with an error.
    | [<CompiledName "ERROR">] Error
    /// The web worker was killed via timeout expiration.
    | [<CompiledName "TIMEOUT_EXPIRED">] TimeoutExpired
