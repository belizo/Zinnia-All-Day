/* ═══════════════════════════════════════════════════════════
   ZINNIA ALL DAY — APPLICATION JS v2
   • Playlist create / edit / reorder (Spotify-style)
   • Schedule chooser: Time-of-Day vs Queue-Based
   • Schedule sidebar: playlists only
   • Vimeo API integration
═══════════════════════════════════════════════════════════ */

// ──────────────────────────────────────────── STATE

const state = {
  vimeoToken:   localStorage.getItem('zinnia_vimeo_token') || '',
  vimeoUserId:  localStorage.getItem('zinnia_vimeo_user')  || '',
  vimeoAlbumId: localStorage.getItem('zinnia_vimeo_album') || '',
  videos:           [],
  filteredVideos:   [],
  selectedVideoIds: new Set(),
  playlists:    JSON.parse(localStorage.getItem('zinnia_playlists') || '[]'),
  activePlaylistId: null,
  currentGenre: 'All',
  scheduleEvents: JSON.parse(localStorage.getItem('zinnia_schedule') || '{}'),
  playQueue:    JSON.parse(localStorage.getItem('zinnia_queue') || '[]'), // array of playlist ids
  currentMonth: new Date(),
  currentWeekStart: getWeekStart(new Date()),
  editingPlaylistId: null,
  editVideos:   [], // working copy during edit
  currentPlayerVideoIndex: 0,
  isPlaying:    false,
  progressTimer: null,
};

// ──────────────────────────────────────────── SEED DATA

const SEED_VIDEOS = [
  { id:'seed1',  title:'Morning Stretches for Seniors',        duration:'8:30',  genre:'Exercise & Meditation', thumb:'', vimeoId:null },
  { id:'seed2',  title:'Cooking Simple Breakfast Meals',       duration:'12:15', genre:'Daily Living',          thumb:'', vimeoId:null },
  { id:'seed3',  title:'Calming Nature Walk – Forest Path',    duration:'22:00', genre:'Nature',                thumb:'', vimeoId:null },
  { id:'seed4',  title:'Memory Quiz: World Capitals',          duration:'10:45', genre:'Quizzes',               thumb:'', vimeoId:null },
  { id:'seed5',  title:'Gentle Chair Yoga',                    duration:'18:00', genre:'Exercise & Meditation', thumb:'', vimeoId:null },
  { id:'seed6',  title:'Understanding Dementia for Families',  duration:'24:30', genre:'Caregiver Education',   thumb:'', vimeoId:null },
  { id:'seed7',  title:'Sunday Hymns – Gospel Favorites',      duration:'30:00', genre:'Faith',                 thumb:'', vimeoId:null },
  { id:'seed8',  title:'Birds at the Backyard Feeder',         duration:'15:00', genre:'Animals',               thumb:'', vimeoId:null },
  { id:'seed9',  title:'Jigsaw Puzzle Walkthrough',            duration:'9:20',  genre:'Fun & Games',           thumb:'', vimeoId:null },
  { id:'seed10', title:'Christmas Traditions Around the World',duration:'17:40', genre:'Holidays',              thumb:'', vimeoId:null },
  { id:'seed11', title:'Knitting & Crocheting for Beginners',  duration:'20:10', genre:'Interests',             thumb:'', vimeoId:null },
  { id:'seed12', title:'Ocean Waves – Relaxation Sound',       duration:'60:00', genre:'Nature',                thumb:'', vimeoId:null },
  { id:'seed13', title:'Daily Grooming Tips',                  duration:'6:50',  genre:'Daily Living',          thumb:'', vimeoId:null },
  { id:'seed14', title:'Big Cat Safari Highlights',            duration:'28:00', genre:'Animals',               thumb:'', vimeoId:null },
  { id:'seed15', title:'Mindful Breathing Exercises',          duration:'12:00', genre:'Exercise & Meditation', thumb:'', vimeoId:null },
  { id:'seed16', title:'Trivia Night: 1960s Music',            duration:'14:15', genre:'Quizzes',               thumb:'', vimeoId:null },
];

const GENRES = [
  'Daily Living','Animals','Caregiver Education','Exercise & Meditation',
  'Faith','Fun & Games','Holidays','Interests','Nature','Quizzes',
];
const GENRE_COLORS = [
  '#a8c5e8','#b4d4a8','#f4c5a8','#c5a8d4',
  '#a8d4c5','#f4e0a8','#d4a8b4','#a8b4d4',
  '#c5d4a8','#e8c5a8',
];
const PL_COLORS = ['#6b9fd4','#7bbf9b','#d49a6b','#9b7bbf','#bf9b7b','#7bbfbf','#d46b9b','#9bd4d4'];

// ──────────────────────────────────────────── INIT

document.addEventListener('DOMContentLoaded', () => {
  renderBrowsePage();
  renderPlaylists();
  renderSchedule();
  renderQueueSchedule();

  if (state.vimeoToken) {
    loadVimeoVideos();
  } else {
    state.videos = SEED_VIDEOS;
    state.filteredVideos = SEED_VIDEOS;
    renderVideoGrid();
  }
});

// ──────────────────────────────────────────── PAGE NAV

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.remove('active');
    if (a.dataset.page === name) a.classList.add('active');
  });
  if (name === 'schedule')       { renderSchedule(); }
  if (name === 'queue-schedule') { renderQueueSchedule(); }
  if (name === 'player')         { renderPlayerPage(); }
  if (name === 'browse')         { renderBrowsePage(); }
}

function toggleSearch() {
  const el = document.getElementById('navSearch');
  el.classList.toggle('open');
  if (el.classList.contains('open')) document.getElementById('globalSearch').focus();
}

// ──────────────────────────────────────────── VIMEO API

async function loadVimeoVideos() {
  const loading = document.getElementById('videoLoading');
  loading.style.display = 'flex';
  const { vimeoToken, vimeoUserId, vimeoAlbumId } = state;
  let endpoint;
  if (vimeoAlbumId && vimeoUserId)
    endpoint = `https://api.vimeo.com/users/${vimeoUserId}/albums/${vimeoAlbumId}/videos?per_page=100&fields=uri,name,duration,pictures,tags`;
  else if (vimeoUserId)
    endpoint = `https://api.vimeo.com/users/${vimeoUserId}/videos?per_page=100&fields=uri,name,duration,pictures,tags`;
  else
    endpoint = `https://api.vimeo.com/me/videos?per_page=100&fields=uri,name,duration,pictures,tags`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        'Authorization': `bearer ${vimeoToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.vimeo.*+json;version=3.4',
      }
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    const videos = (data.data || []).map(v => {
      const id = v.uri.split('/').pop();
      return {
        id, vimeoId: id,
        title: v.name,
        duration: formatDuration(v.duration || 0),
        genre: matchGenre(v.tags?.[0]?.name || '', v.name),
        thumb: v.pictures?.sizes?.[2]?.link || '',
      };
    });
    state.videos = videos;
    state.filteredVideos = videos;
    renderVideoGrid();
    showToast(`Loaded ${videos.length} videos from Vimeo`);
  } catch (err) {
    console.error(err);
    state.videos = SEED_VIDEOS;
    state.filteredVideos = SEED_VIDEOS;
    renderVideoGrid();
    showToast('Could not connect to Vimeo — showing sample videos');
  } finally {
    loading.style.display = 'none';
  }
}

function matchGenre(tag, title) {
  const t = (tag + ' ' + title).toLowerCase();
  if (/animal|dog|cat|bird|pet|wildlife|safari/.test(t))  return 'Animals';
  if (/caregiver|dementia|memory care/.test(t))           return 'Caregiver Education';
  if (/exercise|yoga|stretch|meditat|breath|fitness/.test(t)) return 'Exercise & Meditation';
  if (/faith|hymn|gospel|prayer|church/.test(t))          return 'Faith';
  if (/game|puzzle|bingo|fun|entertain/.test(t))          return 'Fun & Games';
  if (/holiday|christmas|thanksgiving|easter/.test(t))    return 'Holidays';
  if (/interest|hobby|knit|crochet|garden|paint/.test(t)) return 'Interests';
  if (/nature|ocean|forest|rain|wave|calm/.test(t))       return 'Nature';
  if (/quiz|trivia|test/.test(t))                         return 'Quizzes';
  return 'Daily Living';
}

function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
function pad(n) { return String(n).padStart(2,'0'); }

// Vimeo modal
function openVimeoModal() {
  document.getElementById('vimeoToken').value  = state.vimeoToken;
  document.getElementById('vimeoUserId').value = state.vimeoUserId;
  document.getElementById('vimeoAlbumId').value= state.vimeoAlbumId;
  document.getElementById('vimeoModal').classList.add('open');
}
function closeVimeoModal() { document.getElementById('vimeoModal').classList.remove('open'); }
function applyVimeoConfig() {
  const token  = document.getElementById('vimeoToken').value.trim();
  const userId = document.getElementById('vimeoUserId').value.trim();
  const albumId= document.getElementById('vimeoAlbumId').value.trim();
  if (!token) { showToast('Please enter a Vimeo access token'); return; }
  state.vimeoToken   = token;
  state.vimeoUserId  = userId;
  state.vimeoAlbumId = albumId;
  localStorage.setItem('zinnia_vimeo_token', token);
  localStorage.setItem('zinnia_vimeo_user',  userId);
  localStorage.setItem('zinnia_vimeo_album', albumId);
  closeVimeoModal();
  loadVimeoVideos();
}

// ──────────────────────────────────────────── VIDEO GRID

function renderVideoGrid() {
  const grid    = document.getElementById('videoGrid');
  const loading = document.getElementById('videoLoading');
  loading.style.display = 'none';
  grid.querySelectorAll('.video-card,.empty-card').forEach(c => c.remove());

  if (state.filteredVideos.length === 0) {
    const div = document.createElement('div');
    div.className = 'loading-state empty-card';
    div.innerHTML = '<p>No videos found.</p>';
    grid.appendChild(div);
    return;
  }
  state.filteredVideos.forEach(v => grid.appendChild(createVideoCard(v)));
}

function createVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'video-card' + (state.selectedVideoIds.has(video.id) ? ' selected' : '');
  card.dataset.id = video.id;
  card.onclick = () => toggleVideoSelect(video);

  const sel = state.selectedVideoIds.has(video.id);
  card.innerHTML = `
    <div class="video-thumb">
      ${video.thumb
        ? `<img src="${esc(video.thumb)}" alt="${esc(video.title)}" loading="lazy" />`
        : `<div style="width:100%;height:100%;background:var(--bg-item)"></div>`}
      <div class="thumb-overlay">
        <div class="thumb-play">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#072843"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
        ${sel ? `<div class="selected-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
      </div>
    </div>
    <div class="video-meta">
      <h4>${esc(video.title)}</h4>
      <p class="duration">${video.duration}</p>
      <span class="genre-tag">${esc(video.genre)}</span>
    </div>`;
  return card;
}

function toggleVideoSelect(video) {
  if (state.selectedVideoIds.has(video.id)) state.selectedVideoIds.delete(video.id);
  else state.selectedVideoIds.add(video.id);
  updateSelectedUI();
  renderVideoGrid();
}

function removeFromSelection(id) {
  state.selectedVideoIds.delete(id);
  updateSelectedUI();
  renderVideoGrid();
}

function updateSelectedUI() {
  const count = state.selectedVideoIds.size;
  document.getElementById('selectedBadge').style.display = count > 0 ? 'flex' : 'none';
  document.getElementById('selectedCount').textContent   = count;

  const list = document.getElementById('selectedVideosList');
  const msg  = document.getElementById('noSelectionMsg');
  list.innerHTML = '';
  const selected = state.videos.filter(v => state.selectedVideoIds.has(v.id));
  msg.style.display = selected.length === 0 ? '' : 'none';
  selected.forEach(v => {
    const div = document.createElement('div');
    div.className = 'sel-vid-item';
    div.innerHTML = `
      ${v.thumb
        ? `<img src="${esc(v.thumb)}" alt="" />`
        : `<div class="sv-thumb-placeholder"></div>`}
      <span style="flex:1;line-height:1.3">${esc(v.title)}</span>
      <button class="remove-btn" onclick="event.stopPropagation();removeFromSelection('${v.id}')">✕</button>`;
    list.appendChild(div);
  });
}

// ──────────────────────────────────────────── GENRE FILTER

function selectGenre(btn, genre) {
  document.querySelectorAll('#genrePills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  state.currentGenre = genre;
  filterVideos();
}

function filterVideos() {
  const q = document.getElementById('videoSearch').value.toLowerCase();
  state.filteredVideos = state.videos.filter(v => {
    const genreOk = state.currentGenre === 'All' || v.genre === state.currentGenre;
    const textOk  = !q || v.title.toLowerCase().includes(q) || v.genre.toLowerCase().includes(q);
    return genreOk && textOk;
  });
  renderVideoGrid();
}

// ──────────────────────────────────────────── SAVE PLAYLIST

function openSaveModal() {
  document.getElementById('playlistNameInput').value = '';
  document.getElementById('saveModal').classList.add('open');
  setTimeout(() => document.getElementById('playlistNameInput').focus(), 50);
}
function closeSaveModal() { document.getElementById('saveModal').classList.remove('open'); }

function savePlaylist() {
  const name = document.getElementById('playlistNameInput').value.trim();
  if (!name) { showToast('Please enter a playlist name'); return; }
  if (state.selectedVideoIds.size === 0) { showToast('Select at least one video first'); return; }

  const videos = state.videos.filter(v => state.selectedVideoIds.has(v.id));
  const color  = PL_COLORS[state.playlists.length % PL_COLORS.length];
  state.playlists.push({ id: 'pl_' + Date.now(), name, videos, color, createdAt: new Date().toISOString() });
  persistPlaylists();
  renderPlaylists();
  closeSaveModal();
  state.selectedVideoIds.clear();
  updateSelectedUI();
  renderVideoGrid();
  showToast(`Playlist "${name}" saved — ${videos.length} video${videos.length > 1 ? 's' : ''}`);
}

function persistPlaylists() {
  localStorage.setItem('zinnia_playlists', JSON.stringify(state.playlists));
}

// ──────────────────────────────────────────── RENDER PLAYLISTS (sidebar)

function renderPlaylists() {
  const list = document.getElementById('playlistList');
  list.innerHTML = '';
  if (state.playlists.length === 0) {
    list.innerHTML = '<p class="empty-msg" style="padding:8px 0">No playlists yet.</p>';
    return;
  }
  state.playlists.forEach(pl => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.style.background = pl.color;
    item.onclick = () => loadPlaylistIntoSelection(pl.id);
    item.innerHTML = `
      <span>${esc(pl.name)}</span>
      <div class="pl-actions">
        <button class="pl-btn" title="Edit" onclick="event.stopPropagation();openEditModal('${pl.id}')">✎ Edit</button>
        <button class="pl-btn" title="Delete" onclick="event.stopPropagation();deletePlaylist('${pl.id}')">✕</button>
      </div>`;
    list.appendChild(item);
  });
}

function loadPlaylistIntoSelection(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  state.activePlaylistId = id;
  state.selectedVideoIds = new Set(pl.videos.map(v => v.id));
  updateSelectedUI();
  renderVideoGrid();
  showToast(`Loaded "${pl.name}" into selection`);
}

function deletePlaylist(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  if (!confirm(`Delete playlist "${pl.name}"?`)) return;
  state.playlists = state.playlists.filter(p => p.id !== id);
  // remove from queue too
  state.playQueue = state.playQueue.filter(pid => pid !== id);
  persistPlaylists();
  saveQueue();
  renderPlaylists();
  renderSchedulePlaylists();
  renderQueueSchedule();
  showToast('Playlist deleted');
}

// ──────────────────────────────────────────── EDIT MODAL (Spotify-style)

let editDragSrcIdx = null;

function openEditModal(id) {
  const pl = state.playlists.find(p => p.id === id);
  if (!pl) return;
  state.editingPlaylistId = id;
  state.editVideos = pl.videos.map(v => ({ ...v })); // deep copy

  document.getElementById('editModalDot').style.background = pl.color;
  document.getElementById('editPlaylistName').value = pl.name;
  document.getElementById('editVideoCount').textContent = `${pl.videos.length} video${pl.videos.length !== 1 ? 's' : ''}`;
  document.getElementById('editSearch').value = '';

  renderEditList();
  renderEditAvailable();
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
  state.editingPlaylistId = null;
  state.editVideos = [];
}

function renderEditList() {
  const el = document.getElementById('editPlaylistVideos');
  el.innerHTML = '';
  if (state.editVideos.length === 0) {
    el.innerHTML = '<p class="empty-msg">No videos yet. Add some from the right.</p>';
    return;
  }
  state.editVideos.forEach((v, idx) => {
    const row = document.createElement('div');
    row.className = 'ev-item';
    row.draggable = true;
    row.dataset.idx = idx;
    row.innerHTML = `
      <span class="ev-handle" title="Drag to reorder">⠿</span>
      ${v.thumb
        ? `<img src="${esc(v.thumb)}" alt="" />`
        : `<div class="ev-thumb"></div>`}
      <span class="ev-title">${esc(v.title)}</span>
      <span class="ev-dur">${v.duration}</span>
      <button class="ev-remove" onclick="removeFromEditList(${idx})" title="Remove">✕</button>`;

    // drag-and-drop reordering
    row.addEventListener('dragstart', e => {
      editDragSrcIdx = idx;
      row.classList.add('dragging-ev');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      editDragSrcIdx = null;
      row.classList.remove('dragging-ev');
      document.querySelectorAll('.ev-item').forEach(r => r.classList.remove('drag-over-ev'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      document.querySelectorAll('.ev-item').forEach(r => r.classList.remove('drag-over-ev'));
      row.classList.add('drag-over-ev');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over-ev');
      if (editDragSrcIdx === null || editDragSrcIdx === idx) return;
      const moved = state.editVideos.splice(editDragSrcIdx, 1)[0];
      state.editVideos.splice(idx, 0, moved);
      editDragSrcIdx = null;
      renderEditList();
      updateEditCount();
    });

    el.appendChild(row);
  });
}

function removeFromEditList(idx) {
  state.editVideos.splice(idx, 1);
  renderEditList();
  renderEditAvailable();
  updateEditCount();
}

function filterEditVideos() {
  renderEditAvailable();
}

function renderEditAvailable() {
  const el    = document.getElementById('editAvailableVideos');
  const query = (document.getElementById('editSearch')?.value || '').toLowerCase();
  const inPl  = new Set(state.editVideos.map(v => v.id));
  el.innerHTML = '';

  const filtered = state.videos.filter(v =>
    (!query || v.title.toLowerCase().includes(query) || v.genre.toLowerCase().includes(query))
  );
  if (filtered.length === 0) {
    el.innerHTML = '<p class="empty-msg">No videos match.</p>';
    return;
  }
  filtered.forEach(v => {
    const already = inPl.has(v.id);
    const row = document.createElement('div');
    row.className = 'ev-add-item' + (already ? ' already-in' : '');
    row.innerHTML = `
      ${v.thumb
        ? `<img src="${esc(v.thumb)}" alt="" />`
        : `<div class="ev-thumb"></div>`}
      <span style="flex:1;font-size:0.82rem;font-weight:500;line-height:1.3">${esc(v.title)}</span>
      <span class="ev-dur" style="font-size:0.72rem;color:var(--muted)">${v.duration}</span>
      <span class="add-icon">${already ? '✓' : '+'}</span>`;
    if (!already) {
      row.onclick = () => {
        state.editVideos.push({ ...v });
        renderEditList();
        renderEditAvailable();
        updateEditCount();
      };
    }
    el.appendChild(row);
  });
}

function updateEditCount() {
  const n = state.editVideos.length;
  document.getElementById('editVideoCount').textContent = `${n} video${n !== 1 ? 's' : ''}`;
}

function saveEditedPlaylist() {
  const name = document.getElementById('editPlaylistName').value.trim();
  if (!name) { showToast('Please enter a playlist name'); return; }
  const pl = state.playlists.find(p => p.id === state.editingPlaylistId);
  if (!pl) return;
  pl.name   = name;
  pl.videos = [...state.editVideos];
  persistPlaylists();
  renderPlaylists();
  renderSchedulePlaylists();
  renderQueueSchedule();
  closeEditModal();
  showToast(`Playlist "${name}" updated`);
}

// ──────────────────────────────────────────── SCHEDULE CHOOSER

function openScheduleChooser() {
  document.getElementById('scheduleChooser').classList.add('open');
}
function closeScheduleChooser() {
  document.getElementById('scheduleChooser').classList.remove('open');
}
function closeChooserGo(page) {
  closeScheduleChooser();
  showPage(page);
}

// ──────────────────────────────────────────── TIME-OF-DAY SCHEDULE

function getWeekStart(date) {
  const d   = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
}

function changeMonth(dir) {
  state.currentMonth.setMonth(state.currentMonth.getMonth() + dir);
  state.currentWeekStart = getWeekStart(state.currentMonth);
  renderSchedule();
}

function renderSchedule() {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('scheduleMonthTitle').textContent =
    MONTHS[state.currentMonth.getMonth()] + ' ' + state.currentMonth.getFullYear();
  renderWeekHeader();
  renderTimeCol();
  renderDayCols();
  renderSchedulePlaylists();
}

function renderWeekHeader() {
  const el   = document.getElementById('weekHeader');
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const today = new Date(); today.setHours(0,0,0,0);
  el.innerHTML = '<div style="width:56px"></div>';
  for (let i = 0; i < 7; i++) {
    const d = new Date(state.currentWeekStart);
    d.setDate(d.getDate() + i);
    const isToday = d.getTime() === today.getTime();
    const div = document.createElement('div');
    div.className = 'day-head' + (isToday ? ' today' : '');
    div.innerHTML = `<span style="display:block;font-size:0.72rem">${days[i]}</span><span class="day-num">${d.getDate()}</span>`;
    el.appendChild(div);
  }
}

function renderTimeCol() {
  const el = document.getElementById('timeCol');
  el.innerHTML = '';
  for (let h = 6; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const s   = document.createElement('div');
      s.className = 'time-slot';
      const ampm = h < 12 ? 'AM' : 'PM';
      const hh   = h > 12 ? h - 12 : h === 0 ? 12 : h;
      s.textContent = `${hh}:${m === 0 ? '00' : '30'} ${ampm}`;
      el.appendChild(s);
    }
  }
}

function renderDayCols() {
  const el = document.getElementById('dayCols');
  el.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(state.currentWeekStart);
    d.setDate(d.getDate() + i);
    el.appendChild(buildDayCol(d));
  }
}

function buildDayCol(date) {
  const col    = document.createElement('div');
  col.className = 'day-col';
  const dateKey = date.toISOString().split('T')[0];

  for (let h = 6; h < 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slotKey = `${dateKey}_${h}_${m}`;
      const cell    = document.createElement('div');
      cell.className = 'day-cell';
      cell.dataset.slot = slotKey;

      cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.classList.remove('drag-over');
        const plId = e.dataTransfer.getData('playlistId');
        if (plId) dropPlaylistOnSlot(plId, slotKey, h, m);
      });

      const event = state.scheduleEvents[slotKey];
      if (event) {
        cell.classList.add('has-event');
        const pl    = state.playlists.find(p => p.id === event.playlistId);
        const block = document.createElement('div');
        block.className = 'event-block';
        if (pl) block.style.background = pl.color;
        block.draggable = true;
        block.innerHTML = `<span style="overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1">${esc(event.name)}</span>
          <button class="event-remove" onclick="event.stopPropagation();removeScheduleEvent('${slotKey}')">✕</button>`;
        block.addEventListener('dragstart', e => {
          e.dataTransfer.setData('moveEventKey', slotKey);
          block.classList.add('dragging');
        });
        block.addEventListener('dragend', () => block.classList.remove('dragging'));
        cell.appendChild(block);
      }
      col.appendChild(cell);
    }
  }
  return col;
}

function dropPlaylistOnSlot(plId, slotKey, h, m) {
  const pl = state.playlists.find(p => p.id === plId);
  if (!pl) return;
  state.scheduleEvents[slotKey] = { playlistId: plId, name: pl.name, hour: h, min: m };
  localStorage.setItem('zinnia_schedule', JSON.stringify(state.scheduleEvents));
  renderDayCols();
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh   = h > 12 ? h - 12 : h;
  showToast(`"${pl.name}" scheduled at ${hh}:${m === 0 ? '00' : '30'} ${ampm}`);
}

function removeScheduleEvent(slotKey) {
  delete state.scheduleEvents[slotKey];
  localStorage.setItem('zinnia_schedule', JSON.stringify(state.scheduleEvents));
  renderDayCols();
}

function renderSchedulePlaylists() {
  const el    = document.getElementById('schedulePlaylists');
  const empty = document.getElementById('scheduleNoPlaylists');
  if (!el) return;
  el.innerHTML = '';
  if (state.playlists.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';
  state.playlists.forEach(pl => {
    const chip = document.createElement('div');
    chip.className = 'schedule-playlist-chip';
    chip.style.background = pl.color;
    chip.draggable = true;
    const count = pl.videos.length;
    chip.innerHTML = `
      <div>
        <div>${esc(pl.name)}</div>
        <div class="chip-meta">${count} video${count !== 1 ? 's' : ''}</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>`;
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('playlistId', pl.id);
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    el.appendChild(chip);
  });
}

// ──────────────────────────────────────────── QUEUE SCHEDULE

let qsDragSrcId  = null; // being dragged from available
let qsDragQueueIdx = null; // being reordered within queue

function renderQueueSchedule() {
  renderQsAvailable();
  renderQsQueue();
  renderQsSummary();
}

function renderQsAvailable() {
  const el = document.getElementById('qsAvailable');
  el.innerHTML = '';
  if (state.playlists.length === 0) {
    el.innerHTML = '<p class="empty-msg">No playlists yet. <a href="#" onclick="showPage(\'playlists\')">Create one →</a></p>';
    return;
  }
  state.playlists.forEach(pl => {
    const chip = document.createElement('div');
    chip.className = 'qs-chip';
    chip.style.background = pl.color;
    chip.draggable = true;
    chip.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
      </svg>
      <div>
        <div>${esc(pl.name)}</div>
        <div style="font-size:0.7rem;opacity:0.8;font-weight:400">${pl.videos.length} video${pl.videos.length !== 1 ? 's' : ''}</div>
      </div>`;
    chip.addEventListener('dragstart', e => {
      qsDragSrcId = pl.id;
      qsDragQueueIdx = null;
      chip.classList.add('dragging');
      e.dataTransfer.setData('qsPlId', pl.id);
    });
    chip.addEventListener('dragend', () => { chip.classList.remove('dragging'); qsDragSrcId = null; });
    el.appendChild(chip);
  });
}

function renderQsQueue() {
  const list  = document.getElementById('qsQueueList');
  const empty = document.getElementById('qsEmptyMsg');
  list.innerHTML = '';

  if (state.playQueue.length === 0) {
    list.appendChild(empty);
    empty.style.display = '';
    setupQsDropzone(list);
    return;
  }
  empty.style.display = 'none';
  setupQsDropzone(list);

  state.playQueue.forEach((plId, idx) => {
    const pl = state.playlists.find(p => p.id === plId);
    if (!pl) return;
    const item = document.createElement('div');
    item.className = 'qs-queue-item';
    item.style.background = pl.color;
    item.draggable = true;
    item.dataset.idx = idx;
    item.innerHTML = `
      <span class="drag-handle" style="font-size:1rem;opacity:0.7">⠿</span>
      <span style="flex:1">${esc(pl.name)}</span>
      <span style="font-size:0.72rem;opacity:0.8">${pl.videos.length}v</span>
      <button class="remove-qs" onclick="event.stopPropagation();removeFromQueue(${idx})">✕</button>`;

    // reorder within queue
    item.addEventListener('dragstart', e => {
      qsDragQueueIdx = idx;
      qsDragSrcId    = null;
      item.classList.add('dragging');
      e.dataTransfer.setData('qsQueueReorder', idx);
    });
    item.addEventListener('dragend', () => { item.classList.remove('dragging'); qsDragQueueIdx = null; });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      document.querySelectorAll('.qs-queue-item').forEach(r => r.style.borderTop = '');
      item.style.borderTop = '2px solid white';
    });
    item.addEventListener('dragleave', () => item.style.borderTop = '');
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.style.borderTop = '';
      const fromPlId   = e.dataTransfer.getData('qsPlId');
      const fromQIdx   = e.dataTransfer.getData('qsQueueReorder');

      if (fromPlId) {
        // dropping from available list — insert before this item
        if (state.playQueue.includes(fromPlId)) {
          showToast('Already in queue');
        } else {
          state.playQueue.splice(idx, 0, fromPlId);
          saveQueue();
          renderQsQueue();
          renderQsSummary();
        }
      } else if (fromQIdx !== '' && fromQIdx !== undefined) {
        // reorder
        const fi = parseInt(fromQIdx);
        const ti = idx;
        if (fi !== ti) {
          const moved = state.playQueue.splice(fi, 1)[0];
          state.playQueue.splice(ti, 0, moved);
          saveQueue();
          renderQsQueue();
          renderQsSummary();
        }
      }
    });
    list.appendChild(item);
  });
}

function setupQsDropzone(list) {
  list.addEventListener('dragover', e => { e.preventDefault(); list.classList.add('drag-over'); });
  list.addEventListener('dragleave', e => {
    if (!list.contains(e.relatedTarget)) list.classList.remove('drag-over');
  });
  list.addEventListener('drop', e => {
    e.preventDefault();
    list.classList.remove('drag-over');
    const plId = e.dataTransfer.getData('qsPlId');
    if (plId) {
      if (state.playQueue.includes(plId)) { showToast('Already in queue'); return; }
      state.playQueue.push(plId);
      saveQueue();
      renderQsQueue();
      renderQsSummary();
    }
  });
}

function removeFromQueue(idx) {
  state.playQueue.splice(idx, 1);
  saveQueue();
  renderQsQueue();
  renderQsSummary();
}

function clearQueue() {
  if (state.playQueue.length === 0) return;
  state.playQueue = [];
  saveQueue();
  renderQsQueue();
  renderQsSummary();
  showToast('Queue cleared');
}

function saveQueue() { localStorage.setItem('zinnia_queue', JSON.stringify(state.playQueue)); }

function renderQsSummary() {
  const el = document.getElementById('qsSummary');
  if (state.playQueue.length === 0) {
    el.innerHTML = '<p class="empty-msg">Your queue summary will appear here.</p>';
    return;
  }
  const pls   = state.playQueue.map(id => state.playlists.find(p => p.id === id)).filter(Boolean);
  const total = pls.reduce((n, pl) => n + pl.videos.length, 0);
  el.innerHTML = `
    <div class="summary-item">
      <div class="summary-num">${pls.length}</div>
      <div class="summary-label">Playlists queued</div>
    </div>
    <div class="summary-item">
      <div class="summary-num">${total}</div>
      <div class="summary-label">Total videos</div>
    </div>
    <div style="margin-top:14px">
      ${pls.map((pl,i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem">
          <span style="width:20px;font-size:0.72rem;color:var(--muted);font-weight:600">${i+1}</span>
          <span style="width:10px;height:10px;border-radius:50%;background:${pl.color};flex-shrink:0"></span>
          <span style="flex:1">${esc(pl.name)}</span>
          <span style="font-size:0.72rem;color:var(--muted)">${pl.videos.length}v</span>
        </div>`).join('')}
    </div>`;
}

// ──────────────────────────────────────────── BROWSE

function renderBrowsePage() {
  const el = document.getElementById('browseGenres');
  if (!el) return;
  el.innerHTML = '';
  GENRES.forEach((g, i) => {
    const card = document.createElement('div');
    card.className = 'browse-genre-card';
    card.style.background = GENRE_COLORS[i % GENRE_COLORS.length];
    card.textContent = g;
    card.onclick = () => { showPage('playlists'); selectGenreByName(g); };
    el.appendChild(card);
  });
}

function selectGenreByName(genre) {
  document.querySelectorAll('#genrePills .pill').forEach(p => {
    if (p.textContent.trim() === genre) selectGenre(p, genre);
  });
}

// ──────────────────────────────────────────── PLAYER

function renderPlayerPage() {
  let queueVideos = [];
  // Priority: queue-schedule playlists → active playlist → selected videos → first 5
  if (state.playQueue.length > 0) {
    state.playQueue.forEach(plId => {
      const pl = state.playlists.find(p => p.id === plId);
      if (pl) queueVideos.push(...pl.videos);
    });
  } else if (state.activePlaylistId) {
    const pl = state.playlists.find(p => p.id === state.activePlaylistId);
    if (pl) queueVideos = pl.videos;
  }
  if (queueVideos.length === 0)
    queueVideos = state.videos.filter(v => state.selectedVideoIds.has(v.id));
  if (queueVideos.length === 0)
    queueVideos = state.videos.slice(0, 6);

  state.queue = queueVideos;
  state.currentPlayerVideoIndex = 0;

  const queueEl = document.getElementById('queueList');
  queueEl.innerHTML = '';
  queueVideos.forEach((v, idx) => {
    const item = document.createElement('div');
    item.className = 'queue-item' + (idx === 0 ? ' active' : '');
    item.onclick   = () => playVideoAtIndex(idx);
    item.innerHTML = `
      ${v.thumb
        ? `<img src="${esc(v.thumb)}" alt="" />`
        : `<div class="qi-thumb"></div>`}
      <span style="line-height:1.3">${esc(v.title)}</span>`;
    queueEl.appendChild(item);
  });

  if (queueVideos.length > 0) loadPlayerVideo(queueVideos[0]);
}

function loadPlayerVideo(video) {
  const container = document.getElementById('vimeoEmbed');
  document.getElementById('playerVideoTitle').textContent    = video.title;
  document.getElementById('playerVideoDuration').textContent = video.duration;
  document.getElementById('progressFill').style.width = '0%';

  if (video.vimeoId) {
    container.innerHTML = `<iframe
      src="https://player.vimeo.com/video/${video.vimeoId}?autoplay=0&title=0&byline=0&portrait=0"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  } else {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;color:var(--muted)">
        <button class="play-center" onclick="playCurrentVideo()">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <p style="font-size:0.85rem;text-align:center;max-width:260px">${esc(video.title)}</p>
        <p style="font-size:0.75rem">Connect Vimeo to enable playback</p>
      </div>`;
  }
}

function playVideoAtIndex(idx) {
  if (!state.queue || idx >= state.queue.length) return;
  state.currentPlayerVideoIndex = idx;
  document.querySelectorAll('.queue-item').forEach((el, i) => el.classList.toggle('active', i === idx));
  loadPlayerVideo(state.queue[idx]);
}

function playCurrentVideo() { showToast('Configure Vimeo API to enable playback'); }

function togglePlay() {
  state.isPlaying = !state.isPlaying;
  const icon = document.getElementById('playPauseIcon');
  if (state.isPlaying) {
    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    simulateProgress();
  } else {
    icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    clearInterval(state.progressTimer);
  }
}

function simulateProgress() {
  clearInterval(state.progressTimer);
  let pct = parseFloat(document.getElementById('progressFill').style.width) || 0;
  state.progressTimer = setInterval(() => {
    pct = Math.min(pct + 0.12, 100);
    document.getElementById('progressFill').style.width = pct + '%';
    if (pct >= 100) { clearInterval(state.progressTimer); state.isPlaying = false; }
  }, 200);
}

function addCurrentToPlaylist() {
  if (!state.queue?.length) return;
  const video = state.queue[state.currentPlayerVideoIndex];
  state.selectedVideoIds.add(video.id);
  openSaveModal();
}

// ──────────────────────────────────────────── UTILITIES

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ──────────────────────────────────────────── KEYBOARD

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  closeSaveModal();
  closeVimeoModal();
  closeEditModal();
  closeScheduleChooser();
  document.getElementById('navSearch').classList.remove('open');
});

// Close modals on backdrop click
['saveModal','vimeoModal','editModal','scheduleChooser'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    if (e.target === this) {
      if (id === 'saveModal')       closeSaveModal();
      if (id === 'vimeoModal')      closeVimeoModal();
      if (id === 'editModal')       closeEditModal();
      if (id === 'scheduleChooser') closeScheduleChooser();
    }
  });
});
