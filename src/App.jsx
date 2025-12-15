import React, { useEffect, useMemo, useRef, useState } from 'react';

const CONFIG_PATH = '/videos.json';

const defaultBackground = '/background.png';

const loadThumbnailFromVideo = (videoConfig) =>
  new Promise((resolve, reject) => {
    const time = Number(videoConfig.thumbnailTime || 0);
    const video = document.createElement('video');
    video.src = videoConfig.src;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };

    const handleError = (event) => {
      cleanup();
      reject(event?.message || new Error('Unable to read video for thumbnail'));
    };

    const handleSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        cleanup();
        resolve(dataUrl);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const handleMetadata = () => {
      try {
        const seekTo = time > 0 ? Math.min(time, video.duration || time) : 0.1;
        video.currentTime = seekTo;
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.addEventListener('loadedmetadata', handleMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);
  });

const useGeneratedThumbnails = (videos) => {
  const [thumbnails, setThumbnails] = useState({});

  useEffect(() => {
    let cancelled = false;

    const videosNeedingThumbs = videos.filter(
      (video) => !video.thumbnailImage && typeof video.thumbnailTime !== 'undefined',
    );

    videosNeedingThumbs.forEach((video) => {
      loadThumbnailFromVideo(video)
        .then((image) => {
          if (!cancelled) {
            setThumbnails((prev) => ({ ...prev, [video.id]: image }));
          }
        })
        .catch(() => {
          /* noop - fallback will be used */
        });
    });

    return () => {
      cancelled = true;
    };
  }, [videos]);

  return thumbnails;
};

const VideoGrid = ({ videos, onSelect, generatedThumbnails }) => {
  if (!videos.length) {
    return <div className="empty-state">No videos configured yet.</div>;
  }

  return (
    <div className="video-grid">
      {videos.map((video) => {
        const thumb = video.thumbnailImage || generatedThumbnails[video.id] || defaultBackground;
        const label = video.title || video.id;
        return (
          <button
            key={video.id}
            className="video-card"
            type="button"
            onClick={() => onSelect(video)}
            aria-label={label}
            title={label}
          >
            <img className="video-thumb" src={thumb} alt={label} />
          </button>
        );
      })}
    </div>
  );
};

const VideoPlayer = ({ video, onExit }) => {
  const playerRef = useRef(null);
  const [currentSrc, setCurrentSrc] = useState(video.resolvedSrc || video.src);
  const [isReady, setIsReady] = useState(false);

  const poster = video.thumbnailImage;

  useEffect(() => {
    setCurrentSrc(video.resolvedSrc || video.src);
    setIsReady(false);
    const element = playerRef.current;
    if (element) {
      element.load();
    }
  }, [video.id, video.resolvedSrc, video.src]);

  const handleInteraction = () => {
    const element = playerRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
    }
    onExit();
  };

  const handleError = () => {
    if (video.remoteSrc && currentSrc !== video.remoteSrc) {
      setCurrentSrc(video.remoteSrc);
    } else {
      onExit();
    }
  };

  const handleCanPlay = () => {
    const element = playerRef.current;
    setIsReady(true);
    if (element) {
      element.play().catch(() => {
        /* Autoplay might be blocked; user interaction already happened to start playback. */
      });
    }
  };

  return (
    <div className="player-backdrop" onClick={handleInteraction} onTouchStart={handleInteraction}>
      <video
        key={video.id}
        ref={playerRef}
        className={`player${isReady ? ' player--ready' : ''}`}
        src={currentSrc}
        poster={poster}
        controls={false}
        playsInline
        onEnded={onExit}
        onError={handleError}
        onCanPlay={handleCanPlay}
      />
    </div>
  );
};

const App = () => {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(CONFIG_PATH);
        if (!response.ok) {
          throw new Error(`Unable to load videos.json (${response.status})`);
        }
        const payload = await response.json();
        const normalized = (payload?.videos || []).map((video, index) => ({
          ...video,
          id: video.id || `video-${index + 1}`,
          resolvedSrc: video.cachedSrc || video.src,
          remoteSrc: video.remoteSrc || video.src,
        }));
        setVideos(normalized);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to load videos');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const generatedThumbnails = useGeneratedThumbnails(videos);

  const backgroundStyle = useMemo(
    () => ({
      backgroundImage: `url('${defaultBackground}')`,
    }),
    [],
  );

  return (
    <div className="app" style={backgroundStyle}>
      <div className="app__content">
        <div className="home-panel">
          {loading ? <div className="status">Loading videos…</div> : null}
          {error ? <div className="status status--error">{error}</div> : null}

          {!loading && !error ? (
            <VideoGrid
              videos={videos}
              generatedThumbnails={generatedThumbnails}
              onSelect={setSelectedVideo}
            />
          ) : null}
        </div>
      </div>

      {selectedVideo ? <VideoPlayer video={selectedVideo} onExit={() => setSelectedVideo(null)} /> : null}
    </div>
  );
};

export default App;
