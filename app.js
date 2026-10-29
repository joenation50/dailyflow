const STORAGE_KEY = 'dailyflow-state-v1';

function todayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function tomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const defaultState = {
  tasks: [
    { id: crypto.randomUUID(), title: 'Submit proposal draft', priority: 'high', category: 'work', date: todayString(), recurrence: 'none', completed: false },
    { id: crypto.randomUUID(), title: 'Review class notes', priority: 'medium', category: 'study', date: tomorrowString(), recurrence: 'none', completed: false },
    { id: crypto.randomUUID(), title: 'Go for a 30-minute walk', priority: 'low', category: 'health', date: todayString(), recurrence: 'weekly', completed: false },
  ],
  notes: [
    { id: crypto.randomUUID(), text: 'Launch the landing page mockup by Friday.' },
    { id: crypto.randomUUID(), text: 'Remember to follow up on the client email today.' }
  ]
};

const state = loadState();

const taskForm = document.getElementById('task-form');
const noteForm = document.getElementById('note-form');
const taskTitle = document.getElementById('task-title');
const taskPriority = document.getElementById('task-priority');
const taskDate = document.getElementById('task-date');
const taskCategory = document.getElementById('task-category');
const taskRecurrence = document.getElementById('task-recurrence');
const noteInput = document.getElementById('note-input');
const todayList = document.getElementById('today-list');
const upcomingList = document.getElementById('upcoming-list');
const weekList = document.getElementById('week-list');
const notesList = document.getElementById('notes-list');
const focusList = document.getElementById('focus-list');
const quickAddBtn = document.getElementById('quick-add-btn');
const todayLabel = document.getElementById('today-label');
const todayCount = document.getElementById('today-count');
const upcomingCount = document.getElementById('upcoming-count');
const completedCount = document.getElementById('completed-count');
const focusScore = document.getElementById('focus-score');
const focusTitle = document.getElementById('focus-title');

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);

  try {
    return JSON.parse(saved);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(dateString) {
  if (!dateString) return 'No date';

  const date = new Date(dateString + 'T12:00:00');
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(date);
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

function getTodayTasks() {
  const today = todayString();
  return state.tasks.filter(task => !task.completed && task.date === today).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

function getUpcomingTasks() {
  const today = todayString();
  return state.tasks
    .filter(task => !task.completed && task.date && task.date !== today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 6);
}

function getWeekTasks() {
  return state.tasks
    .filter(task => !task.completed && task.date && isWithinDays(task.date, 7))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getCompletedTasks() {
  return state.tasks.filter(task => task.completed).length;
}

function renderFocus() {
  const focused = state.tasks
    .filter(task => !task.completed)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 3);

  if (!focused.length) {
    focusList.innerHTML = '<li>All caught up.</li>';
    focusTitle.textContent = 'All clear';
    return;
  }

  focusTitle.textContent = `${focused.length} priorities`;
  focusList.innerHTML = focused.map(task => `<li>${task.title}</li>`).join('');
}

function renderStats() {
  const today = getTodayTasks();
  const upcoming = getUpcomingTasks();
  const completed = getCompletedTasks();
  const incompleteCount = state.tasks.filter(task => !task.completed).length;
  const total = state.tasks.length || 1;
  const focusPercent = Math.round(((state.tasks.length - incompleteCount) / total) * 100);

  todayCount.textContent = String(today.length);
  upcomingCount.textContent = String(upcoming.length);
  completedCount.textContent = String(completed);
  focusScore.textContent = `${focusPercent}%`;
}

function renderTaskList(container, tasks, isUpcoming = false) {
  if (!tasks.length) {
    container.innerHTML = '<li class="empty-state">No tasks here yet.</li>';
    return;
  }

  container.innerHTML = tasks.map(task => {
    const recurrenceText = task.recurrence && task.recurrence !== 'none' ? ` • ${task.recurrence}` : '';
    const actionButton = isUpcoming
      ? `<button class="delete-btn" data-del="${task.id}">Remove</button>`
      : `<button class="complete-btn" data-id="${task.id}">Done</button>`;

    return `
      <li class="task-item">
        <div class="task-item-main">
          <span class="task-bullet priority-${task.priority}"></span>
          <div>
            <p class="task-title">${task.title}</p>
            <div class="task-meta">${task.category} • ${formatDate(task.date)}${recurrenceText}</div>
          </div>
        </div>
        <div>
          ${actionButton}
        </div>
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
      <button class="delete-btn" data-note="${note.id}">Delete</button>
    </li>
  `).join('');
}

function render() {
  const date = new Date();
  todayLabel.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  renderStats();
  renderFocus();
  renderTaskList(todayList, getTodayTasks(), false);
  renderTaskList(upcomingList, getUpcomingTasks(), true);
  renderTaskList(weekList, getWeekTasks(), true);
  renderNotes();
}

function addTask(event) {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) return;

  const newTask = {
    id: crypto.randomUUID(),
    title,
    priority: taskPriority.value,
    category: taskCategory.value,
    date: taskDate.value || todayString(),
    recurrence: taskRecurrence.value,
    completed: false,
  };

  state.tasks.unshift(newTask);
  saveState();
  taskForm.reset();
  taskPriority.value = 'medium';
  taskCategory.value = 'work';
  taskRecurrence.value = 'none';
  render();
}

function addNote(event) {
  event.preventDefault();
  const text = noteInput.value.trim();
  if (!text) return;

  state.notes.unshift({ id: crypto.randomUUID(), text });
  saveState();
  noteForm.reset();
  render();
}

function toggleCompleted(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  task.completed = true;
  saveState();
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(task => task.id !== id);
  saveState();
  render();
}

function deleteNote(id) {
  state.notes = state.notes.filter(note => note.id !== id);
  saveState();
  render();
}

taskForm.addEventListener('submit', addTask);
noteForm.addEventListener('submit', addNote);
quickAddBtn.addEventListener('click', () => {
  taskTitle.focus();
});

document.addEventListener('click', event => {
  const doneButton = event.target.closest('.complete-btn');
  const deleteButton = event.target.closest('.delete-btn');
  const noteDeleteButton = event.target.closest('[data-note]');
  const taskDeleteButton = event.target.closest('[data-del]');

  if (doneButton) {
    toggleCompleted(doneButton.dataset.id);
  }

  if (taskDeleteButton) {
    deleteTask(taskDeleteButton.dataset.del);
  }

  if (noteDeleteButton) {
    deleteNote(noteDeleteButton.dataset.note);
  }

  if (deleteButton && !taskDeleteButton && !noteDeleteButton) {
    const id = deleteButton.dataset.del || deleteButton.dataset.note;
    if (id) deleteTask(id);
  }
});

render();
