'use client';

import { upload } from '@vercel/blob/client';
import { useEffect, useRef, useState } from 'react';

export default function Admin() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [password, setPassword] = useState('');
  const [playlist, setPlaylist] = useState({ items: [], settings: { imageDurationSeconds: 8 } });
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        setAuthed(data.authed);
        if (data.authed) refresh();
      })
      .catch(() => setAuthed(false));
  }, []);

  async function refresh() {
    const res = await fetch('/api/playlist', { cache: 'no-store' });
    if (res.ok) setPlaylist(await res.json());
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setPassword('');
      refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Login failed.');
    }
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    setAuthed(false);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const label = files.length > 1 ? `(${i + 1}/${files.length}) ${file.name}` : file.name;
      try {
        setUploadStatus(`Uploading ${label}…`);
        const blob = await upload(file.name, file, {
          access: 'public',
          handleUploadUrl: `${window.location.origin}/api/upload`,
          multipart: true,
          onUploadProgress: ({ percentage }) =>
            setUploadStatus(`Uploading ${label}… ${Math.round(percentage)}%`),
        });
        // Register the uploaded file in the playlist.
        const res = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            contentType: blob.contentType || file.type,
            name: file.name,
          }),
        });
        if (!res.ok) throw new Error('Upload succeeded but adding to playlist failed.');
        setPlaylist(await res.json());
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err.message}`);
        break;
      }
    }
    setUploadStatus('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function savePlaylist(next) {
    setPlaylist(next); // optimistic
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/playlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Save failed.');
      }
      setPlaylist(await res.json());
    } catch (err) {
      setError(err.message);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  function move(index, delta) {
    const items = [...playlist.items];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    savePlaylist({ ...playlist, items });
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This removes the file permanently.`)) return;
    setError('');
    const res = await fetch('/api/media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: item.url }),
    });
    if (res.ok) {
      setPlaylist(await res.json());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Delete failed.');
    }
  }

  function setImageDuration(value) {
    setPlaylist((p) => ({ ...p, settings: { ...p.settings, imageDurationSeconds: value } }));
  }

  if (authed === null) {
    return <main className="admin"><p className="muted">Loading…</p></main>;
  }

  if (!authed) {
    return (
      <main className="admin">
        <form className="login-box card" onSubmit={handleLogin}>
          <h2>Admin login</h2>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button className="primary" type="submit">Log in</button>
          {error && <p className="error">{error}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin">
      <div className="admin-header">
        <h1>Media admin</h1>
        <div className="row">
          <a href="/" target="_blank" rel="noreferrer"><button>Open TV player</button></a>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <section className="card">
        <h2>Upload media</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFiles}
          disabled={Boolean(uploadStatus)}
        />
        {uploadStatus && <p className="progress">{uploadStatus}</p>}
        <p className="muted" style={{ marginTop: 8 }}>
          Images and videos. Videos play muted on the TV.
        </p>
      </section>

      <section className="card">
        <h2>Settings</h2>
        <div className="row">
          <label htmlFor="img-duration">Show each image for</label>
          <input
            id="img-duration"
            type="number"
            min="1"
            max="600"
            style={{ width: 80 }}
            value={playlist.settings.imageDurationSeconds}
            onChange={(e) => setImageDuration(e.target.value)}
          />
          <span>seconds</span>
          <button className="primary" disabled={saving} onClick={() => savePlaylist(playlist)}>
            Save
          </button>
        </div>
      </section>

      <section className="card">
        <h2>
          Playlist ({playlist.items.length} item{playlist.items.length === 1 ? '' : 's'})
          {saving && <span className="muted"> — saving…</span>}
        </h2>
        {playlist.items.length === 0 ? (
          <p className="muted">Nothing here yet. Upload some media above.</p>
        ) : (
          <ul className="media-list">
            {playlist.items.map((item, i) => (
              <li className="media-item" key={item.id || item.url}>
                {item.type === 'video' ? (
                  <video className="media-thumb" src={item.url} muted preload="metadata" />
                ) : (
                  <img className="media-thumb" src={item.url} alt="" />
                )}
                <div className="media-info">
                  <div className="media-name">{item.name}</div>
                  <div className="media-type">{item.type}</div>
                </div>
                <div className="media-actions">
                  <button className="icon" title="Move up" disabled={i === 0 || saving} onClick={() => move(i, -1)}>↑</button>
                  <button className="icon" title="Move down" disabled={i === playlist.items.length - 1 || saving} onClick={() => move(i, 1)}>↓</button>
                  <button className="icon danger" title="Delete" disabled={saving} onClick={() => handleDelete(item)}>✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ marginTop: 12 }}>
          The TV picks up changes automatically within about a minute.
        </p>
      </section>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
