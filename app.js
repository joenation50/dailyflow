const STORAGE_KEY = 'dailyflow-state-v1';

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authMessage = document.getElementById('authMessage');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const toggleButtons = document.querySelectorAll('.toggle-btn');
const logoutBtn = document.getElementById('logoutBtn');

const todayLabel = document.getElementById('today-label');
const todayCount = document.getElementById('today-count');
const upcomingCount = document.getElementById('upcoming-count');
const completedCount = document.getElementById('completed-count');
const focusScore = document.getElementById('focus-score');
const focusTitle = document.getElementById('focus-title');
const focusList = document.getElementById('focus-list');
const todayList = document.getElementById('todayList');
const upcomingList = document.getElementById('upcomingList');
const weekList = document.getElementById('weekList');
const notesList = document.getElementById('notesList');

const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskPriority = document.getElementById('taskPriority');
const taskDate = document.getElementById('taskDate');
const taskCategory = document.getElementById('taskCategory');
const taskRecurrence = document.getElementById('taskRecurrence');
const noteForm = document.getElementById('noteForm');
const noteInput = document.getElementById('noteInput');
const quickAddBtn = document.getElementById('quick-add-btn');

const state = {
  user: null,
  tasks: [],
  notes: []
};

async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

function setAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? '#ef4444' : '#10b981';
}

function setViewMode(loggedIn) {
  authView.classList.toggle('hidden', loggedIn);
  appView.classList.toggle('hidden', !loggedIn);
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateString) {
  if (!dateString) return 'No date';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(dateString + 'T12:00:00'));
}

function priorityRank(priority) {
  return { high: 3, medium: 2, low: 1 }[priority] || 0;
}

function isWithinDays(dateString, days) {
  if (!dateString) return false;
  const target = new Date(dateString + 'T12:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + days);
  return target >= today && target <= maxDate;
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31');
  });
}

function renderFocus() {
  const focused = sortTasks(state.tasks.filter(task => !task.completed)).slice(0, 3);
  if (!focused.length) {
    focusTitle.textContent = 'All clear';
    focusList.innerHTML = '<li>All caught up.</li>';
    return;
  }

  focusTitle.textContent = `${focused.length} priorities`;
  focusList.innerHTML = focused.map(task => `<li>${task.title}</li>`).join('');
}

function renderStats() {
  const todayTasks = state.tasks.filter(task => !task.completed && task.date === getTodayString());
  const upcomingTasks = state.tasks.filter(task => !task.completed && task.date && task.date !== getTodayString());
  const completedTasks = state.tasks.filter(task => task.completed).length;
  const totalCount = state.tasks.length || 1;
  const completion = Math.round(((state.tasks.length - state.tasks.filter(task => !task.completed).length) / totalCount) * 100);

  todayCount.textContent = String(todayTasks.length);
  upcomingCount.textContent = String(upcomingTasks.length);
  completedCount.textContent = String(completedTasks);
  focusScore.textContent = `${completion}%`;
}

function renderTaskList(container, tasks, showDelete = false) {
  if (!tasks.length) {
    container.innerHTML = '<li class="empty-state">No tasks here yet.</li>';
    return;
  }

  container.innerHTML = tasks.map(task => {
    const action = task.completed
      ? '<button class="delete-btn" data-task-id="' + task.id + '">Remove</button>'
      : showDelete
        ? '<button class="delete-btn" data-task-id="' + task.id + '">Remove</button>'
        : '<button class="complete-btn" data-task-id="' + task.id + '">Done</button>';

    return `
      <li class="task-item">
        <div class="task-item-main">
          <span class="task-bullet priority-${task.priority}"></span>
          <div>
            <p class="task-title">${task.title}</p>
            <div class="task-meta">${task.category} • ${formatDate(task.date)}${task.recurrence && task.recurrence !== 'none' ? ' • ' + task.recurrence : ''}</div>
          </div>
        </div>
        <div>${action}</div>
      </li>
    `;
  }).join('');
}

function renderNotes() {
  if (!state.notes.length) {
    notesList.innerHTML = '<li class="empty-state">No notes yet. Capture one above.</li>';
    return;
  }

  notesList.innerHTML = state.notes.map(note => `
    <li class="note-item">
      <div class="task-item-main">
        <span class="task-bullet priority-low"></span>
        <div>
          <p class="task-title">Idea</p>
          <p class="note-text">${note.text}</p>
        </div>
      </div>
      <button class="delete-btn" data-note-id="${note.id}">Delete</button>
    </li>
  `).join('');
}

function render() {
  const date = new Date();
  todayLabel.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  renderStats();
  renderFocus();

  const todayTasks = sortTasks(state.tasks.filter(task => !task.completed && task.date === getTodayString()));
  const upcomingTasks = sortTasks(state.tasks.filter(task => !task.completed && task.date && task.date !== getTodayString())).slice(0, 6);
  const weeklyTasks = sortTasks(state.tasks.filter(task => !task.completed && task.date && isWithinDays(task.date, 7)));

  renderTaskList(todayList, todayTasks, false);
  renderTaskList(upcomingList, upcomingTasks, true);
  renderTaskList(weekList, weeklyTasks, true);
  renderNotes();
}

async function loadDashboard() {
  try {
    const [taskData, noteData] = await Promise.all([
      apiRequest('/api/tasks'),
      apiRequest('/api/notes')
    ]);

    state.tasks = taskData.tasks || [];
    state.notes = noteData.notes || [];
    render();
  } catch (err) {
    console.error(err);
  }
}

async function loadSession() {
  try {
    const data = await apiRequest('/api/session');
    state.user = data.user;
    if (state.user) {
      setViewMode(true);
      await loadDashboard();
      return;
    }
  } catch (err) {
    console.error(err);
  }

  setViewMode(false);
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.user = result.user;
    setViewMode(true);
    setAuthMessage('Login successful');
    loginForm.reset();
    await loadDashboard();
  } catch (err) {
    setAuthMessage(err.message, true);
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  try {
    const result = await apiRequest('/api/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.user = result.user;
    setViewMode(true);
    setAuthMessage('Account created successfully');
    signupForm.reset();
    await loadDashboard();
  } catch (err) {
    setAuthMessage(err.message, true);
  }
}

async function handleLogout() {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
    state.user = null;
    state.tasks = [];
    state.notes = [];
    setViewMode(false);
    setAuthMessage('');
  } catch (err) {
    console.error(err);
  }
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const payload = {
    title: taskTitle.value.trim(),
    priority: taskPriority.value,
    category: taskCategory.value,
    date: taskDate.value || getTodayString(),
    recurrence: taskRecurrence.value
  };

  if (!payload.title) return;

  try {
    await apiRequest('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    taskForm.reset();
    taskPriority.value = 'medium';
    taskCategory.value = 'work';
    taskRecurrence.value = 'none';
    await loadDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function handleNoteSubmit(event) {
  event.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return;

  try {
    await apiRequest('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    noteForm.reset();
    await loadDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function markTaskComplete(taskId) {
  try {
    await apiRequest(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true })
    });
    await loadDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function deleteTask(taskId) {
  try {
    await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (err) {
    console.error(err);
  }
}

async function deleteNote(noteId) {
  try {
    await apiRequest(`/api/notes/${noteId}`, { method: 'DELETE' });
    await loadDashboard();
  } catch (err) {
    console.error(err);
  }
}

loginForm.addEventListener('submit', handleLoginSubmit);
signupForm.addEventListener('submit', handleSignupSubmit);
logoutBtn.addEventListener('click', handleLogout);
taskForm.addEventListener('submit', handleTaskSubmit);
noteForm.addEventListener('submit', handleNoteSubmit);
quickAddBtn.addEventListener('click', () => taskTitle.focus());

toggleButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.dataset.authTab;
    toggleButtons.forEach(btn => btn.classList.toggle('active', btn === button));
    loginForm.classList.toggle('visible', tab === 'login');
    loginForm.classList.toggle('hidden', tab !== 'login');
    signupForm.classList.toggle('visible', tab === 'signup');
    signupForm.classList.toggle('hidden', tab !== 'signup');
  });
});

document.addEventListener('click', event => {
  const completeBtn = event.target.closest('.complete-btn');
  const deleteTaskBtn = event.target.closest('[data-task-id]');
  const deleteNoteBtn = event.target.closest('[data-note-id]');

  if (completeBtn) {
    markTaskComplete(completeBtn.dataset.taskId);
  }

  if (deleteTaskBtn && !deleteTaskBtn.classList.contains('complete-btn')) {
    deleteTask(deleteTaskBtn.dataset.taskId);
  }

  if (deleteNoteBtn) {
    deleteNote(deleteNoteBtn.dataset.noteId);
  }
});

loadSession();
