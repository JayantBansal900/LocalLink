// Function to add a new category dynamically
document.addEventListener('DOMContentLoaded', () => {
    const addCatBtn = document.getElementById('addCategoryButton');
    if (addCatBtn) {
        addCatBtn.addEventListener('click', function() {
            const catInput = document.getElementById('newCategory');
            const newCategory = catInput ? catInput.value.trim() : '';

            if (newCategory) {
                const filterContainer = document.querySelector('.filter-options');
                if (filterContainer) {
                    const newFilter = document.createElement('label');
                    newFilter.innerHTML = `<input type="checkbox" name="profession" value="${newCategory.toLowerCase()}" class="filter-checkbox"> ${newCategory}`;
                    filterContainer.appendChild(newFilter);
                }
                if (catInput) catInput.value = ''; // Clear input

                addFilterListeners(); // Re-apply event listeners to new checkboxes
            }
        });
    }

    // Initialize filter listeners on page load
    addFilterListeners();
});

// Function to handle card filtering based on selected checkboxes
function filterCards() {
    const selectedFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(checkbox => checkbox.value);
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const profession = card.getAttribute('data-profession');
        if (selectedFilters.length === 0 || selectedFilters.includes(profession)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Function to add event listeners to all filter checkboxes
function addFilterListeners() {
    const checkboxes = document.querySelectorAll('.filter-checkbox');
    checkboxes.forEach(checkbox => {
        if (checkbox) {
            checkbox.removeEventListener('change', filterCards);
            checkbox.addEventListener('change', filterCards);
        }
    });
}
