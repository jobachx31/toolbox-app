document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const addToolForm = document.getElementById('add-tool-form');
    const toolGrid = document.getElementById('tool-grid');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const modal = document.getElementById('add-tool-modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFileInput = document.getElementById('import-file-input');
    const alertModal = document.getElementById('alert-modal');
    const alertModalTitle = document.getElementById('alert-modal-title');
    const alertModalMessage = document.getElementById('alert-modal-message');
    const alertModalButtons = document.getElementById('alert-modal-buttons');

    // To store the callback for the confirmation modal
    let confirmCallback = null;

    // --- Application State ---
    let tools = [];
    let draggedItem = null;
    let editingToolId = null;
    let isInitialLoad = true; // Flag to check for the first page load
    let ghostTile = null;

    // --- Functions ---

    /**
     * Loads tools from localStorage.
     */
    function loadTools() {
        const storedTools = localStorage.getItem('toolbox-tools');
        if (storedTools) {
            tools = JSON.parse(storedTools);
        }
    }

    /**
     * Saves the current tools array to localStorage.
     */
    function saveTools() {
        localStorage.setItem('toolbox-tools', JSON.stringify(tools));
    }

    /**
     * Renders the tools in the grid, optionally filtering by a search term.
     * @param {string} [filter=''] - The search term to filter tools by.
     */
    function renderTools(filter = '') {
        toolGrid.innerHTML = ''; // Clear existing grid
        const lowercasedFilter = filter.toLowerCase();

        const filteredTools = tools.filter(tool =>
            tool.name.toLowerCase().includes(lowercasedFilter) ||
            (tool.tags && tool.tags.toLowerCase().includes(lowercasedFilter))
        );

        if (filteredTools.length === 0 && tools.length > 0) {
            toolGrid.innerHTML = '<p class="grid-empty-message">No tools match your search.</p>';
            return;
        }
        
        if (tools.length === 0) {
            toolGrid.innerHTML = '<p class="grid-empty-message">Click the + button to add a tool</p>';
            return;
        }

        filteredTools.forEach((tool, index) => {
            const toolTile = document.createElement('div');
            toolTile.classList.add('tool-tile');
            toolTile.setAttribute('draggable', 'true');
            toolTile.dataset.id = tool.id;

            if (isInitialLoad) {
                toolTile.classList.add('animate-in');
                toolTile.style.animationDelay = `${index * 50}ms`; // Stagger the animation
            }

            const tagsHTML = tool.tags
                ? tool.tags.split(' ').filter(tag => tag).slice(0, 4).map(tag => `<span class="tag-badge">${tag}</span>`).join('')
                : '';

            toolTile.innerHTML = `
                <button class="delete-btn" title="Delete tool"><span class="material-symbols-outlined">delete</span></button>
                <button class="edit-btn" title="Edit tool"><span class="material-symbols-outlined">edit</span></button>
                <h3><a href="${tool.url}" target="_blank" rel="noopener noreferrer">${tool.name}</a></h3>
                <div class="tags-container">
                    ${tagsHTML || '<p style="opacity: 0.6; font-size: 0.8rem;">No tags provided.</p>'}
                </div>
            `;

            // Add event listener for the delete button
            toolTile.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering drag events
                deleteTool(tool.id);
            });

            toolTile.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openEditModal(tool.id);
            });

            // Add event listener for the whole tile to be clickable
            toolTile.addEventListener('click', (e) => {
                // Do not open link if the click was on the delete button or the link itself
                if (e.target.closest('.delete-btn') || e.target.closest('a')) {
                    return;
                }
                window.open(tool.url, '_blank', 'noopener,noreferrer');
            });

            toolGrid.appendChild(toolTile);
        });

        initDragAndDrop();

        // After the first render, set the flag to false so animations don't re-run on search/filter
        if (isInitialLoad) {
            isInitialLoad = false;
        }
    }

    /**
     * Adds a new tool to the collection.
     * @param {Event} e - The form submission event.
     */
    function addTool(e) {
        e.preventDefault();
        const nameInput = document.getElementById('tool-name');
        const urlInput = document.getElementById('tool-url');
        const tagsInput = document.getElementById('tool-tags');

        if (!nameInput.value.trim() || !urlInput.value.trim()) {
            showAlert('Validation Error', 'Tool Name and URL are required.');
            return;
        }

        if (editingToolId) {
            // Find the tool and update it
            const toolToUpdate = tools.find(tool => tool.id === editingToolId);
            if (toolToUpdate) {
                toolToUpdate.name = nameInput.value.trim();
                toolToUpdate.url = urlInput.value.trim();
                toolToUpdate.tags = tagsInput.value.trim();
            }
            editingToolId = null; // Reset editing state
        } else {
            // Add a new tool
            const newTool = {
                id: Date.now().toString(),
                name: nameInput.value.trim(),
                url: urlInput.value.trim(),
                tags: tagsInput.value.trim(),
            };
            tools.unshift(newTool);
        }

        saveTools();
        renderTools();
        addToolForm.reset(); // Clear the form
        closeModal(); // Close modal after adding
    }

    /**
     * Deletes a tool by its ID.
     * @param {string} id - The ID of the tool to delete.
     */
    function deleteTool(id) {
        const onConfirm = () => {
            tools = tools.filter(tool => tool.id !== id);
            saveTools();
            renderTools(searchInput.value); // Re-render with current filter
        };
        showConfirmation('Delete Tool', 'Are you sure you want to delete this tool?', onConfirm);
    }

    /**
     * Updates the order of tools in the state array based on the DOM.
     */
    function updateOrderInStorage() {
        const newOrderIds = [...toolGrid.querySelectorAll('.tool-tile')].map(tile => tile.dataset.id);
        
        // Reorder the `tools` array to match the DOM order
        tools.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
        
        saveTools();
    }

    /**
     * Opens the 'Add Tool' modal.
     */
    function openAddModal() {
        editingToolId = null; // Ensure we're not in edit mode
        document.getElementById('add-tool-form').reset();
        document.querySelector('.form-section h2').textContent = 'Add a New Tool';
        document.querySelector('.btn-add').textContent = 'Add Tool';
        modal.classList.remove('hidden');
        document.getElementById('tool-name').focus();
    }

    function openEditModal(id) {
        const tool = tools.find(t => t.id === id);
        if (!tool) return;

        editingToolId = id;

        document.getElementById('tool-name').value = tool.name;
        document.getElementById('tool-url').value = tool.url;
        document.getElementById('tool-tags').value = tool.tags || '';

        document.querySelector('.form-section h2').textContent = 'Edit Tool';
        document.querySelector('.btn-add').textContent = 'Save Changes';

        modal.classList.remove('hidden');
        document.getElementById('tool-name').focus();
    }

    /**
     * Closes the 'Add Tool' modal.
     */
    function closeModal() {
        editingToolId = null;
        modal.classList.add('hidden');
    }

    /**
     * Exports the current set of tools to a JSON file.
     */
    function exportTools() {
        if (tools.length === 0) {
            showAlert("Export Failed", "There are no tools to export.");
            return;
        }
        const dataStr = JSON.stringify(tools, null, 2); // Pretty-print JSON
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `toolbox-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Imports tools from a user-selected JSON file.
     * @param {Event} e - The file input change event.
     */
    function importTools(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedTools = JSON.parse(event.target.result);
                // Basic validation of the imported data structure
                if (!Array.isArray(importedTools) || (importedTools.length > 0 && !importedTools[0].id)) {
                    throw new Error("Invalid file format.");
                }

                const onConfirm = () => {
                    tools = importedTools;
                    saveTools();
                    renderTools();
                };

                showConfirmation(
                    'Import Tools', 
                    'This will replace all your current tools. Are you sure you want to continue?', 
                    onConfirm
                );

            } catch (error) {
                showAlert('Import Error', `Error importing file: ${error.message}`);
            } finally {
                importFileInput.value = ''; // Reset file input
            }
        };
        reader.readAsText(file);
    }

    /**
     * Shows a generic alert modal.
     * @param {string} title - The title for the modal.
     * @param {string} message - The message to display.
     */
    function showAlert(title, message) {
        alertModalTitle.textContent = title;
        alertModalMessage.textContent = message;
        alertModalButtons.innerHTML = '<button id="alert-modal-confirm" class="btn-secondary">OK</button>';
        alertModal.classList.remove('hidden');
        document.getElementById('alert-modal-confirm').focus();
    }

    /**
     * Shows a confirmation modal with confirm/cancel actions.
     * @param {string} title - The title for the modal.
     * @param {string} message - The message to display.
     * @param {Function} onConfirm - The callback function to execute on confirmation.
     */
    function showConfirmation(title, message, onConfirm) {
        alertModalTitle.textContent = title;
        alertModalMessage.textContent = message;
        alertModalButtons.innerHTML = `
            <button id="alert-modal-cancel" class="btn-secondary">Cancel</button>
            <button id="alert-modal-confirm" class="btn-danger">Confirm</button>
        `;
        confirmCallback = onConfirm;
        alertModal.classList.remove('hidden');
        document.getElementById('alert-modal-confirm').focus();
    }
    /**
     * Initializes drag and drop event listeners for all tool tiles.
     */
    function initDragAndDrop() {
        toolGrid.querySelectorAll('.tool-tile').forEach(tile => {
            // --- MOUSE-TRACKING SHADOW EFFECT ---
            tile.addEventListener('mousemove', e => {
                const rect = tile.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const deltaX = x - centerX;
                const deltaY = y - centerY;

                // Apply a factor to control shadow distance, without inverting
                const shadowX = deltaX / 10;
                const shadowY = deltaY / 10;

                tile.style.setProperty('--shadow-offset-x', `${shadowX}px`);
                tile.style.setProperty('--shadow-offset-y', `${shadowY}px`);
            });

            tile.addEventListener('mouseleave', () => {
                // Reset the shadow to its default position when the mouse leaves
                tile.style.setProperty('--shadow-offset-x', `0px`);
                tile.style.setProperty('--shadow-offset-y', `5px`);
            });
            // --- REORDER LOGIC ---
            tile.addEventListener('dragstart', () => {
                // Make sure cursor is grab/grabbing even when clicking on non-link part
                tile.style.cursor = 'grabbing';
                draggedItem = tile;

                // Create and insert ghost tile
                ghostTile = document.createElement('div');
                ghostTile.className = 'tool-tile-ghost';
                tile.parentElement.insertBefore(ghostTile, tile);

                setTimeout(() => tile.classList.add('dragging'), 0);
            });

            tile.addEventListener('dragend', () => {
                setTimeout(() => {
                    tile.style.cursor = 'pointer';
                    draggedItem.classList.remove('dragging');
                    draggedItem = null;
                    // Remove ghost tile on drag end
                    if (ghostTile && ghostTile.parentElement) {
                        ghostTile.parentElement.removeChild(ghostTile);
                    }
                    ghostTile = null;
                }, 0);
            });

            tile.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(toolGrid, e.clientY);
                if (afterElement == null) { // If dragging to the end
                    toolGrid.appendChild(ghostTile);
                } else {
                    toolGrid.insertBefore(ghostTile, afterElement);
                }
            });
            
            tile.addEventListener('drop', e => {
                e.preventDefault();
                updateOrderInStorage();
            });

            tile.addEventListener('drop', e => {
                e.preventDefault();
                toolGrid.insertBefore(draggedItem, ghostTile); // Move the actual item to the ghost's position
                updateOrderInStorage();
            });
        });
    }

    /**
     * Helper function to determine where to drop the dragged item.
     * @param {HTMLElement} container - The grid container.
     * @param {number} y - The vertical mouse position.
     * @returns {HTMLElement|null} The element to insert before, or null.
     */
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.tool-tile:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }


    // --- Event Listeners ---
    addToolForm.addEventListener('submit', addTool);
    searchInput.addEventListener('input', () => renderTools(searchInput.value));
    searchBtn.addEventListener('click', () => {
        searchInput.focus();
    });
    openModalBtn.addEventListener('click', openAddModal);
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        // Close modal if the overlay is clicked, but not the content inside
        if (e.target === modal) closeModal();
    });
    exportBtn.addEventListener('click', exportTools);
    importBtn.addEventListener('click', () => {
        // Trigger the hidden file input
        importFileInput.click();
    });
    importFileInput.addEventListener('change', importTools);
    alertModal.addEventListener('click', (e) => {
        if (e.target === alertModal) { // Clicked on overlay
            alertModal.classList.add('hidden');
            confirmCallback = null; // Clear callback
        }
        if (e.target.id === 'alert-modal-cancel') {
            alertModal.classList.add('hidden');
            confirmCallback = null; // Clear callback
        }
        if (e.target.id === 'alert-modal-confirm') {
            alertModal.classList.add('hidden');
            if (confirmCallback) confirmCallback();
            confirmCallback = null; // Clear callback
        }
    });

    // --- Initial Load ---
    loadTools();
    renderTools();
});
