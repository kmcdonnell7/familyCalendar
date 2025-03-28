let calendars = JSON.parse(localStorage.getItem('calendars')) || [
  { id: 1, name: 'Main Calendar', appointments: {} }
];
let activeCalendarId = parseInt(localStorage.getItem('activeCalendarId')) || 1;
let currentDate = new Date();

const appointmentTypes = {
  family: { name: 'Family', color: '#FF9F9F', borderColor: '#FF6B6B' },
  child1: { name: 'Child 1', color: '#9FD4FF', borderColor: '#2196F3' },
  child2: { name: 'Child 2', color: '#B4FF9F', borderColor: '#4CAF50' },
  child3: { name: 'Child 3', color: '#FFE59F', borderColor: '#FFC107' },
  adults: { name: 'Adults', color: '#E09FFF', borderColor: '#9C27B0' }
};

const WEATHER_API_KEY = '<insert key>';
const lat = '40.9098';
const lon = '-73.7829';  // Adding the longitude for New York
const WEATHER_API_URL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;
const FORECAST_API_URL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`;

document.addEventListener("DOMContentLoaded", () => {
  initializeCalendars();
  loadTasks();
  updateWeather(); // Initial weather update
  document.getElementById('add-calendar-btn').addEventListener('click', addNewCalendar);
  
  // Update weather every 30 minutes
  setInterval(updateWeather, 30 * 60 * 1000);
});

function initializeCalendars() {
  renderTabs();
  renderCalendarViews();
  setActiveCalendar(activeCalendarId);
}

function renderTabs() {
  const tabButtons = document.querySelector('.tab-buttons');
  tabButtons.innerHTML = '';
  
  calendars.forEach(calendar => {
    const tab = document.createElement('button');
    tab.className = 'tab-button';
    tab.setAttribute('data-calendar-id', calendar.id);
    
    tab.innerHTML = `
      ${calendar.name}
      ${calendars.length > 1 ? `<span class="delete-tab">×</span>` : ''}
    `;
    
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-tab')) {
        deleteCalendar(calendar.id);
      } else {
        setActiveCalendar(calendar.id);
      }
    });
    
    tabButtons.appendChild(tab);
  });
}

function renderCalendarViews() {
  const calendarViews = document.querySelector('.calendar-views');
  calendarViews.innerHTML = '';
  
  calendars.forEach(calendar => {
    const view = document.createElement('div');
    view.className = 'calendar-container';
    view.setAttribute('data-calendar-id', calendar.id);
    
    // Add month navigation
    const monthNav = document.createElement('div');
    monthNav.className = 'month-navigation';
    monthNav.innerHTML = `
      <button class="nav-btn prev-month">←</button>
      <h2 class="month-title"></h2>
      <button class="nav-btn next-month">→</button>
    `;
    
    // Add legend
    const legend = document.createElement('div');
    legend.className = 'calendar-legend';
    legend.innerHTML = Object.entries(appointmentTypes).map(([key, type]) => `
      <div class="legend-item" data-type="${key}">
        <span class="color-dot" style="background-color: ${type.color}"></span>
        <span>${type.name}</span>
      </div>
    `).join('');
    
    view.appendChild(monthNav);
    view.appendChild(legend);
    
    // Add calendar grid structure
    view.innerHTML += `
      <div class="calendar-header">
        <div>Sunday</div>
        <div>Monday</div>
        <div>Tuesday</div>
        <div>Wednesday</div>
        <div>Thursday</div>
        <div>Friday</div>
        <div>Saturday</div>
      </div>
      <div class="calendar"></div>
    `;
    
    calendarViews.appendChild(view);
    
    // Add event listeners for month navigation and legend
    setupCalendarControls(view, calendar.id);
  });
}

function setupCalendarControls(view, calendarId) {
  const prevBtn = view.querySelector('.prev-month');
  const nextBtn = view.querySelector('.next-month');
  
  prevBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    generateCalendar(currentDate.getFullYear(), currentDate.getMonth(), calendarId);
  });
  
  nextBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    generateCalendar(currentDate.getFullYear(), currentDate.getMonth(), calendarId);
  });
  
  // Add legend item click handlers
  view.querySelectorAll('.legend-item').forEach(item => {
    item.addEventListener('click', () => {
      view.querySelectorAll('.legend-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
  
  // Generate initial calendar
  generateCalendar(currentDate.getFullYear(), currentDate.getMonth(), calendarId);
}

function setActiveCalendar(calendarId) {
  activeCalendarId = calendarId;
  
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-calendar-id') == calendarId);
  });
  
  // Update calendar views
  document.querySelectorAll('.calendar-container').forEach(view => {
    view.classList.toggle('active', view.getAttribute('data-calendar-id') == calendarId);
  });
}

function addNewCalendar() {
  const name = prompt('Enter calendar name:');
  if (name) {
    const newId = Math.max(...calendars.map(c => c.id)) + 1;
    calendars.push({ id: newId, name, appointments: {} });
    saveCalendars();
    initializeCalendars();
    setActiveCalendar(newId);
  }
}

function deleteCalendar(calendarId) {
  if (confirm('Are you sure you want to delete this calendar?')) {
    calendars = calendars.filter(c => c.id !== calendarId);
    if (activeCalendarId === calendarId) {
      activeCalendarId = calendars[0].id;
    }
    saveCalendars();
    initializeCalendars();
  }
}

// Add this function to fetch forecast data
async function getForecastData() {
  try {
    const response = await fetch(FORECAST_API_URL);
    const data = await response.json();
    return data.list.reduce((acc, item) => {
      const date = new Date(item.dt * 1000);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!acc[dateKey]) {
        acc[dateKey] = {
          temp: item.main.temp,
          icon: item.weather[0].icon,
          description: item.weather[0].description
        };
      }
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching forecast:', error);
    return {};
  }
}

// Update the generateCalendar function to include weather
async function generateCalendar(year, month, calendarId) {
  const forecastData = await getForecastData();
  const calendarView = document.querySelector(`.calendar-container[data-calendar-id="${calendarId}"]`);
  const calendar = calendarView.querySelector('.calendar');
  const monthTitle = calendarView.querySelector('.month-title');
  
  calendar.innerHTML = '';
  
  // Add month name
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  monthTitle.textContent = `${monthNames[month]} ${year}`;
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDay; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day empty';
    calendar.appendChild(emptyDay);
  }
  
  const calendarData = calendars.find(c => c.id === calendarId);
  const monthKey = `${year}-${month}`;
  const storedAppointments = calendarData.appointments[monthKey] || {};
  
  // Add the days of the month
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    const dayTitle = document.createElement('h3');
    dayTitle.textContent = day;
    
    // Add weather info if available
    const dateKey = `${year}-${month}-${day}`;
    if (forecastData[dateKey]) {
      const weatherInfo = document.createElement('div');
      weatherInfo.className = 'day-weather';
      weatherInfo.innerHTML = `
        <img src="http://openweathermap.org/img/wn/${forecastData[dateKey].icon}.png" alt="weather">
        <span>${Math.round(forecastData[dateKey].temp)}°C</span>
      `;
      dayCell.appendChild(weatherInfo);
    }
    
    const appointments = document.createElement('div');
    appointments.classList.add('appointments');
    appointments.setAttribute('data-day', day);
    
    // Add stored appointments for this day
    if (storedAppointments[day]) {
      storedAppointments[day].forEach((appointment, index) => {
        const apptItem = document.createElement("div");
        apptItem.className = `appointment-${appointment.type}`;
        
        // Add delete button and appointment text in a container
        apptItem.innerHTML = `
          <div class="appointment-content">
            <span>${appointment.text}</span>
            <button class="delete-btn" title="Delete appointment">×</button>
          </div>
        `;
        
        // Add delete functionality
        apptItem.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm('Delete this appointment?')) {
            calendar.appointments[monthKey][day].splice(index, 1);
            if (calendar.appointments[monthKey][day].length === 0) {
              delete calendar.appointments[monthKey][day];
            }
            saveCalendars();
            generateCalendar(year, month, calendarId);
          }
        });
        
        appointments.appendChild(apptItem);
      });
    }
    
    const addAppointmentBtn = document.createElement('button');
    addAppointmentBtn.textContent = '+';
    addAppointmentBtn.className = 'add-appointment-btn';
    addAppointmentBtn.onclick = () => addAppointment(day, calendarId);
    
    dayCell.appendChild(dayTitle);
    dayCell.appendChild(appointments);
    dayCell.appendChild(addAppointmentBtn);
    
    calendar.appendChild(dayCell);
  }
  
  // Add empty cells for remaining days to complete the grid
  const remainingDays = (7 - ((startingDay + totalDays) % 7)) % 7;
  for (let i = 0; i < remainingDays; i++) {
    const emptyDay = document.createElement('div');
    emptyDay.className = 'calendar-day empty';
    calendar.appendChild(emptyDay);
  }
}

// Add this function to create a modal for multi-day appointments
function createAppointmentModal(startDay, calendarId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Add Appointment</h3>
      <div class="modal-form">
        <div class="form-group">
          <label>Description:</label>
          <input type="text" id="appointment-text" placeholder="Enter appointment description">
        </div>
        <div class="form-group">
          <label>Start Date:</label>
          <input type="date" id="start-date" value="${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}">
        </div>
        <div class="form-group">
          <label>End Date:</label>
          <input type="date" id="end-date" value="${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}">
        </div>
        <div class="form-group">
          <button id="save-appointment" class="modal-btn">Save</button>
          <button id="cancel-appointment" class="modal-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  return new Promise((resolve, reject) => {
    document.getElementById('save-appointment').onclick = () => {
      const text = document.getElementById('appointment-text').value;
      const startDate = new Date(document.getElementById('start-date').value);
      const endDate = new Date(document.getElementById('end-date').value);
      
      if (text && startDate && endDate) {
        modal.remove();
        resolve({ text, startDate, endDate });
      } else {
        alert('Please fill in all fields');
      }
    };
    
    document.getElementById('cancel-appointment').onclick = () => {
      modal.remove();
      reject();
    };
    
    // Close modal when clicking outside
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
        reject();
      }
    };
  });
}

// Update the addAppointment function
async function addAppointment(day, calendarId) {
  const calendarView = document.querySelector(`.calendar-container[data-calendar-id="${calendarId}"]`);
  const selectedType = calendarView.querySelector('.legend-item.selected');
  
  if (!selectedType) {
    alert('Please select an appointment type from the legend first');
    return;
  }
  
  const appointmentType = selectedType.dataset.type;
  
  try {
    const appointmentDetails = await createAppointmentModal(day, calendarId);
    const { text, startDate, endDate } = appointmentDetails;
    
    const calendar = calendars.find(c => c.id === calendarId);
    
    // Calculate all dates between start and end
    const dates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
      const dayNum = currentDate.getDate();
      
      // Initialize the structure if it doesn't exist
      if (!calendar.appointments[monthKey]) {
        calendar.appointments[monthKey] = {};
      }
      if (!calendar.appointments[monthKey][dayNum]) {
        calendar.appointments[monthKey][dayNum] = [];
      }
      
      // Add the appointment
      calendar.appointments[monthKey][dayNum].push({
        text,
        type: appointmentType,
        isMultiDay: true,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      
      dates.push({
        monthKey,
        day: dayNum
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Save to localStorage
    saveCalendars();
    
    // Refresh the calendar view
    generateCalendar(currentDate.getFullYear(), currentDate.getMonth(), calendarId);
    
  } catch (error) {
    // Modal was cancelled
    console.log('Appointment creation cancelled');
  }
}

function addTask() {
  const taskInput = document.getElementById("new-task");
  const taskValue = taskInput.value.trim();
  
  if (taskValue) {
    const taskList = document.getElementById("task-list");
    const taskItem = createTaskElement(taskValue, false);
    taskList.appendChild(taskItem);
    
    // Save to localStorage
    saveTasks();
    
    taskInput.value = ""; // Clear input
  } else {
    alert("Please enter a task.");
  }
}

function createTaskElement(text, completed) {
  const taskItem = document.createElement("li");
  taskItem.className = 'task-item';
  
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = completed;
  
  const taskText = document.createElement("span");
  taskText.className = "task-text" + (completed ? " completed" : "");
  taskText.textContent = text;
  
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.title = "Delete task";
  
  deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this task?')) {
      taskItem.remove();
      saveTasks();
    }
  });
  
  checkbox.addEventListener('change', function() {
    taskText.classList.toggle('completed');
    saveTasks();
  });
  
  taskItem.appendChild(checkbox);
  taskItem.appendChild(taskText);
  taskItem.appendChild(deleteBtn);
  
  return taskItem;
}

function saveTasks() {
  const tasks = [];
  document.querySelectorAll('#task-list .task-item').forEach(item => {
    tasks.push({
      text: item.querySelector('.task-text').textContent,
      completed: item.querySelector('.task-checkbox').checked
    });
  });
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function loadTasks() {
  const taskList = document.getElementById("task-list");
  const savedTasks = JSON.parse(localStorage.getItem('tasks')) || [];
  
  savedTasks.forEach(task => {
    const taskItem = createTaskElement(task.text, task.completed);
    taskList.appendChild(taskItem);
  });
}

function saveCalendars() {
  localStorage.setItem('calendars', JSON.stringify(calendars));
  localStorage.setItem('activeCalendarId', activeCalendarId);
}

// Add this function to fetch and update weather
async function updateWeather() {
  try {
    const response = await fetch(WEATHER_API_URL);
    const data = await response.json();
    
    const weatherIcon = document.querySelector('.weather-icon');
    const weatherTemp = document.querySelector('.weather-temp');
    const weatherDesc = document.querySelector('.weather-desc');
    
    // Update temperature
    weatherTemp.textContent = `${Math.round(data.main.temp)}°C`;
    
    // Update description
    weatherDesc.textContent = data.weather[0].description;
    
    // Update icon
    const iconCode = data.weather[0].icon;
    weatherIcon.style.backgroundImage = `url(http://openweathermap.org/img/wn/${iconCode}@2x.png)`;
    
  } catch (error) {
    console.error('Error fetching weather:', error);
  }
}