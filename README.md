# sample-mse-memory-usage
minimal sample to investigate unexpected increase memory with [Media Source Extensions](https://www.w3.org/TR/media-source/).

## How to run sample

### via github pages

https://tasukuuno.github.io/sample-mse-memory-usage/

### via local

```sh
npm install
npm start
```
then open http://localhost:8080

## What was happened?

There was a memory leak that ArrayBuffers were not removed from sourceBuffer.

![before](https://user-images.githubusercontent.com/4372047/34107759-b82b4eec-e440-11e7-9bbd-2471589e4d40.png)  

## What was wrong?

See [this diff](https://github.com/TasukuUno/sample-mse-memory-usage/compare/ffe142bbc8dcfd109a617c59001bdc2bb404611f...bc1e43b669f5c4176b3f56fab75bfb72aa08536d?w=1).  
It seems necessary to wait for `SourceBuffer#remove()` to complete before calling `MediaSource#endOfStream()`.

![after](https://user-images.githubusercontent.com/4372047/34107758-b8073f34-e440-11e7-97a9-75e907a95ca0.png)
