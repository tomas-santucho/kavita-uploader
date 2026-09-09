const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const uploadBtn = document.getElementById('upload-btn');
const statusDiv = document.getElementById('status');
const librarySelect = document.getElementById('library-select');
const newLibraryContainer = document.getElementById('new-library-container');
const newLibraryInput = document.getElementById('new-library-input');
const refreshLibsBtn = document.getElementById('refresh-libs');
const loginForm = document.getElementById('login-form');
const uploader = document.getElementById('uploader');
const loginStatus = document.getElementById('login-status');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

let filesToUpload = [];

async function showUploaderIfLoggedIn() {
    const response = await fetch('/session');
    const session = await response.json();
    if (!session.username) return;
    loginForm.classList.add('hidden');
    uploader.classList.remove('hidden');
    loadLibraries();
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const response = await fetch('/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value }) });
    if (!response.ok) { loginStatus.textContent = (await response.json()).error; return; }
    loginStatus.textContent = '';
    loginForm.classList.add('hidden');
    uploader.classList.remove('hidden');
    loadLibraries();
});

refreshLibsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loadLibraries();
});

// Fetch existing libraries
async function loadLibraries() {
    try {
        const response = await fetch('/libraries');
        if (!response.ok) throw new Error('Network response was not ok');
        const libraries = await response.json();
        
        // Save current selection
        const currentSelection = librarySelect.value;
        
        // Clear existing options
        librarySelect.innerHTML = '';
        
        // Add Root option
        const rootOption = document.createElement('option');
        rootOption.value = "";
        rootOption.textContent = "Root (Main Library)";
        librarySelect.appendChild(rootOption);
        
        // Add existing libraries
        if (Array.isArray(libraries)) {
            libraries.forEach(lib => {
                const option = document.createElement('option');
                option.value = lib;
                option.textContent = lib;
                librarySelect.appendChild(option);
            });
        }
        
        // Add Create New option
        const otherOption = document.createElement('option');
        otherOption.value = "__NEW__";
        otherOption.textContent = "+ Create New Library...";
        librarySelect.appendChild(otherOption);
        
        // Restore selection if possible
        if (currentSelection && [...librarySelect.options].some(opt => opt.value === currentSelection)) {
            librarySelect.value = currentSelection;
        }

    } catch (error) {
        console.error('Error loading libraries:', error);
        statusDiv.innerHTML = 'Error loading libraries. Please check console.';
        statusDiv.className = 'status error';
    }
}

librarySelect.addEventListener('change', () => {
    if (librarySelect.value === "__NEW__") {
        newLibraryContainer.classList.remove('hidden');
        newLibraryInput.focus();
    } else {
        newLibraryContainer.classList.add('hidden');
    }
});

showUploaderIfLoggedIn();

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    for (const file of files) {
        filesToUpload.push(file);
    }
    updateFileList();
    uploadBtn.disabled = filesToUpload.length === 0;
}

function updateFileList() {
    fileList.innerHTML = '';
    filesToUpload.forEach((file, index) => {
        const item = document.createElement('div');
        item.classList.add('file-item');
        const name = document.createElement('span');
        name.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.type = 'button';
        removeButton.setAttribute('aria-label', `Remove ${file.name}`);
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => removeFile(index));
        item.append(name, removeButton);
        fileList.appendChild(item);
    });
}

function removeFile(index) {
    filesToUpload.splice(index, 1);
    updateFileList();
    uploadBtn.disabled = filesToUpload.length === 0;
}

uploadBtn.addEventListener('click', async () => {
    if (filesToUpload.length === 0) return;

    let targetLibrary = librarySelect.value;
    if (targetLibrary === "__NEW__") {
        targetLibrary = newLibraryInput.value.trim();
        if (!targetLibrary) {
            alert("Please enter a name for the new library");
            newLibraryInput.focus();
            return;
        }
    }

    uploadBtn.disabled = true;
    statusDiv.innerHTML = 'Uploading...';
    statusDiv.className = 'status';

    const formData = new FormData();
    formData.append('library', targetLibrary);
    filesToUpload.forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            statusDiv.innerHTML = 'All files uploaded successfully!';
            statusDiv.className = 'status success';
            filesToUpload = [];
            updateFileList();
            await loadLibraries(); // Refresh library list
            newLibraryContainer.classList.add('hidden');
            newLibraryInput.value = '';
            librarySelect.value = targetLibrary; // Select the library we just uploaded to
        } else {
            const errorText = await response.text();
            statusDiv.innerHTML = 'Upload failed: ' + errorText;
            statusDiv.className = 'status error';
            uploadBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error uploading:', error);
        statusDiv.innerHTML = 'Error: ' + error.message;
        statusDiv.className = 'status error';
        uploadBtn.disabled = false;
    }
});
