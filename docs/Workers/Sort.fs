module Workers.Sort

let rng = System.Random()

let sortNumbers () =
    Array.init 5000000 (fun _ -> rng.NextDouble() * 1000000.)
    |> Array.sort
    |> Array.sum
    |> int