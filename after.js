(function () {
  // configurations
  var AUDIO_URL = './sample.mp4';
  var AUDIO_MIME_TYPE = 'audio/mp4; codecs="mp4a.40.2"';
  var AUTO_RESET = true;
  var AUTO_RESET_SEC = 3;
  var REUSE_DATA = true;

  var isLoading = false;
  var data = [];
  var audioElement = null;
  var mediaSource = null;
  var objectURL = null;
  var sourceBuffer = null;
  var loadIndex = 0;
  var timeRange = { start: 0, end: 0 };
  var count = document.title = 0;

  var out = document.getElementById('out');
  document.getElementById('start').addEventListener('click', start);
  document.getElementById('resetData').addEventListener('click', resetData);
  document.getElementById('resetMSE').addEventListener('click', resetMSE);

  // entry point
  function start() {
    console.log('start');

    if (isLoading) {
      console.log('wait a minute!');
      return;
    }

    isLoading = true;

    resetMSE()
      .then(() => {
        if (!REUSE_DATA) {
          resetData();
        }
      })
      .then(() => loadData())
      .then(() => {
        startAudioPlayback();
        document.title = ++count;

        if (AUTO_RESET) {
          setTimeout(() => {
            isLoading = false;
            start();
          }, AUTO_RESET_SEC * 1000);
        } else {
          isLoading = false;
        }
      });
  }

  // load array buffers via XHR
  function loadData() {
    if (data.length) {
      return Promise.resolve();
    }
    console.log('loadData');

    return new Promise(resolve => {
      get(0);

      function get(start) {
        var unit = 2 * 1024 * 1024; // 2MB
        var xhr = new XMLHttpRequest();
        var end = start + unit;
        xhr.open('GET', AUDIO_URL, true);
        xhr.responseType = 'arraybuffer';
        xhr.setRequestHeader('Range', `bytes=${start}-${end}`);
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status === 206) {
            data.push(xhr.response);
            var matches = xhr.getResponseHeader('content-range').match(/(\d+)-(\d+)\/(\d+)/);
            var to = Number(matches[2]);
            var total = Number(matches[3]);
            if (to + 1 >= total) {
              console.log('loadData complete');
              resolve();
            } else {
              get(to + 1);
            }
          }
        };
        xhr.send(null);
      }
    });
  }

  // entry point of playback
  function startAudioPlayback() {
    console.log('play');
    audioElement = new Audio();
    audioElement.controls = true;
    audioElement.style.cssText = 'display: block; width: 100%;';
    mediaSource = new MediaSource();
    objectURL = URL.createObjectURL(mediaSource);
    audioElement.src = objectURL;
    out.appendChild(audioElement);
    audioElement.addEventListener('timeupdate', update);
    mediaSource.addEventListener('sourceopen', onSourceopen);
  }

  // this event will fire from MediaSource
  function onSourceopen() {
    console.log('onSourceopen');
    mediaSource.removeEventListener('sourceopen', onSourceopen);
    sourceBuffer = mediaSource.addSourceBuffer(AUDIO_MIME_TYPE);
    sourceBuffer.addEventListener('updateend', onUpdateEnd);
    update();
  }

  // this event will fire from SourceBuffer
  function onUpdateEnd() {
    sourceBuffer.appendWindowStart = 0;
    sourceBuffer.appendWindowEnd = audioElement.duration;

    const buffered = sourceBuffer.buffered;
    const start = buffered.start(0);
    const end = buffered.end(buffered.length - 1);
    const duration = end - start;
    timeRange = {
      start: start,
      end: end,
    };

    console.log('onUpdateEnd:', {
      appendWindowStart: sourceBuffer.appendWindowStart,
      appendWindowEnd: sourceBuffer.appendWindowEnd,
      start: start,
      end: end,
    });

    if (duration > 10) {
      audioElement.play();
    }

    update();
  }

  // this event will fire from Audio
  function onTimeupdate() {
    update();
  }

  // this function will be called from onSourceopen, onUpdateEnd and onTimeupdate
  // add next buffer if it is required
  function update() {
    if (!data[loadIndex]) {
      console.log('update skip: !data[loadIndex]');
      return;
    }

    if (!sourceBuffer || !mediaSource || !audioElement) {
      return;
    }

    if (sourceBuffer.updating) {
      console.log('update skip: sourceBuffer.updating');
      return;
    }

    if (mediaSource.readyState === 'closed') {
      console.log('update skip: mediaSource.readyState === \'closed\'');
      return;
    }

    if (timeRange.end - audioElement.currentTime > 2 * 60) {
      console.log('update skip: timeRange.end - audioElement.currentTime > 30');
      return;
    }

    console.log('will append buffer', loadIndex);
    sourceBuffer.appendBuffer(data[loadIndex]);
    loadIndex++;
  }

  // reset ArrayBuffers on memory
  function resetData() {
    data = [];
    console.log('resetData');
  }

  // reset all of elements about Audio Playback
  // NOTE: Rewrite to async to wait for the buffer to be removed.
  function resetMSE() {
    return new Promise(resolve => {
      if (sourceBuffer && sourceBuffer.updating) {
        sourceBuffer.abort();
        console.log('sourceBuffer.abort()');
      }

      if (audioElement) {
        audioElement.removeEventListener('timeupdate', onTimeupdate);
        audioElement.pause();
        console.log('reset audioElement');
      }

      if (sourceBuffer) {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.addEventListener('updateend', onBufferRemoved);
        sourceBuffer.remove(timeRange.start, timeRange.end);
        console.log('will remove sourceBuffer');
      }

      if (mediaSource) {
        mediaSource.removeEventListener('sourceopen', onSourceopen);
      }

      if (!sourceBuffer) {
        resolve();
      }

      function onBufferRemoved() {
        console.log('removed sourceBuffer');
        sourceBuffer.removeEventListener('updateend', onBufferRemoved);
        resolve();
      }
    })
    .then(() => {
      if (mediaSource) {
        mediaSource.removeSourceBuffer(sourceBuffer);
        mediaSource.endOfStream();
        console.log('remove mediaSource');
      }

      if (audioElement && objectURL) {
        URL.revokeObjectURL(objectURL);
        delete audioElement.src;
        audioElement.remove();
        console.log('remove audioElement');
      }

      audioElement = null;
      mediaSource = null;
      objectURL = null;
      sourceBuffer = null;
      loadIndex = 0;
      timeRange = { start: 0, end: 0 };
    });
  }

})();
