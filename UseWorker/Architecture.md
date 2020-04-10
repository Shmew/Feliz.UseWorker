# Feliz.UseWorker - Architecture

## How does this work?

This library has slightly differing implementation
based on if you're using a react hook or elmish.
Which the differences are explained below.

### Worker Creation

The worker is created dynamically at runtime when
requested. This is accomplished by creating a `Blob`
url from the actual body of the worker. In essence instead
of a script tag that contains the worker code it is built
at runtime and provided to the browser. 

In order to support the F# BCL, a script still needs 
to be provided to the worker for it to know how to properly 
run the code given. This is accomplished by including the 
worker in your application like you would any other file. 
Webpack allows us to compile the worker as a normal javascript 
file. Then, when the worker in your application is created 
it gets pointed to that file and via the provided `WorkerFunc`
and set options.

The library has some defaults where it will expect the file to 
be, which can be modified when creating the worker. You don't 
need to worry about trying to import or manage other dependencies
that the worker needs, simply open the namespace in the worker
file and use it. Please note *any namespace opened that 
uses/imports a library that needs DOM access will not work!*

### Worker Management

The shared functionality between the two is that a
`MailboxProcessor` is created for each worker that is
spawned. This mailbox handles all communication between
the worker and the front-end application. The mailbox gets
created with a subscriber (implementation is based on 
hook/Elmish) which will be called whenever the `WorkerStatus` 
changes, then whenever the worker status updates it is 
immediately reflected in your application.

The mailbox handles all cleanup of the workers and itself 
so you don't need to worry about anything aside from just 
creating the workers and handling their state changes.

#### React Hook

The subscriber for the React hook is simply a React state object
that is passed back to your React component. This means when the 
status changes it is immediately reflected as such inside your
component.

#### Elmish

The subscriber when using Elmish is actually a second 
`MailboxProcessor`, which is passed along to your loop as a 
subscriber. When the status changes the mailbox will dispatch
a msg to your application indicating that the state has changed.
