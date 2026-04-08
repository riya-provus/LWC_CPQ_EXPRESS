import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAddons from '@salesforce/apex/AddonListController.getAddons';
import createAddon from '@salesforce/apex/AddonListController.createAddon';
import deleteAddon from '@salesforce/apex/AddonListController.deleteAddon';
import toggleAddonActive from '@salesforce/apex/AddonListController.toggleAddonActive';

export default class CpqAddonsList extends LightningElement {
    @track addons = [];
    @track filteredAddons = [];
    @track isModalOpen = false;
    @track isViewDropdownOpen = false;
    @track searchTerm = '';
    @track density = 'default';
    
    @track newAddon = {
        name: '',
        description: '',
        billingUnit: 'Each',
        price: 0,
        cost: 0,
        tags: '',
        active: true,
        city: '',
        state: '',
        country: ''
    };

    @track columns = [
        { id: 'id', label: 'ID', visible: true },
        { id: 'name', label: 'Name', visible: true },
        { id: 'location', label: 'Location', visible: true },
        { id: 'billingUnit', label: 'Billing Unit', visible: true },
        { id: 'price', label: 'Price', visible: true },
        { id: 'cost', label: 'Cost', visible: true },
        { id: 'tags', label: 'Tags', visible: true },
        { id: 'active', label: 'Active', visible: true }
    ];

    wiredAddonsResult;

    @wire(getAddons)
    wiredAddons(result) {
        this.wiredAddonsResult = result;
        if (result.data) {
            this.addons = result.data.map((addon, index) => ({
                ...addon,
                counter: index + 1,
                formattedPrice: this.formatCurrency(addon.Price__c),
                formattedCost: this.formatCurrency(addon.Cost__c)
            }));
            this.filterData();
        } else if (result.error) {
            this.showToast('Error', 'Failed to fetch add-ons', 'error');
        }
    }

    // --- Computed ---

    get visibleColumnCount() {
        return this.columns.filter(col => col.visible).length;
    }

    get tableClass() {
        return `custom-table ${this.density === 'compact' ? 'compact' : ''}`;
    }

    get densityDefaultClass() {
        return `toggle-btn ${this.density === 'default' ? 'active' : ''}`;
    }

    get densityCompactClass() {
        return `toggle-btn ${this.density === 'compact' ? 'active' : ''}`;
    }

    get isColVisible() {
        const visibleMap = {};
        this.columns.forEach(col => {
            visibleMap[col.id] = col.visible;
        });
        return visibleMap;
    }

    get descriptionCharCount() {
        return this.newAddon.description ? this.newAddon.description.length : 0;
    }

    // --- Handlers ---

    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.filterData();
    }

    filterData() {
        if (!this.searchTerm) {
            this.filteredAddons = [...this.addons];
        } else {
            this.filteredAddons = this.addons.filter(addon => 
                addon.Name.toLowerCase().includes(this.searchTerm) ||
                addon.Addon_ID__c.toLowerCase().includes(this.searchTerm) ||
                (addon.Tags__c && addon.Tags__c.toLowerCase().includes(this.searchTerm))
            );
        }
    }

    handleNewAddon() {
        this.resetNewAddonForm();
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
    }

    stopProp(event) {
        event.stopPropagation();
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.type === 'checkbox' || event.target.type === 'toggle' ? event.target.checked : event.target.value;
        this.newAddon[field] = value;
    }

    async saveAddon() {
        if (!this.newAddon.name || this.newAddon.price === undefined || !this.newAddon.billingUnit) {
            this.showToast('Error', 'Please fill in all required fields', 'error');
            return;
        }

        this.isCreating = true;
        const locationStr = [this.newAddon.city, this.newAddon.state, this.newAddon.country].filter(Boolean).join(', ');

        try {
            await createAddon({
                name: this.newAddon.name,
                description: this.newAddon.description,
                billingUnit: this.newAddon.billingUnit,
                price: this.newAddon.price,
                cost: this.newAddon.cost,
                tags: this.newAddon.tags,
                active: this.newAddon.active,
                city: this.newAddon.city,
                state: this.newAddon.state,
                country: this.newAddon.country,
                location: locationStr
            });
            this.showToast('Success', 'Add-on created successfully', 'success');
            this.isModalOpen = false;
            await refreshApex(this.wiredAddonsResult);
        } catch (error) {
            this.showToast('Error', error.body.message, 'error');
        } finally {
            this.isCreating = false;
        }
    }

    async handleDelete(event) {
        const addonId = event.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this add-on?')) {
            try {
                await deleteAddon({ addonId });
                this.showToast('Success', 'Add-on deleted', 'success');
                await refreshApex(this.wiredAddonsResult);
            } catch (error) {
                this.showToast('Error', error.body.message, 'error');
            }
        }
    }

    async handleStatusToggle(event) {
        const addonId = event.target.dataset.id;
        const active = event.target.checked;
        try {
            await toggleAddonActive({ addonId, active });
        } catch (error) {
            this.showToast('Error', 'Failed to update status', 'error');
            await refreshApex(this.wiredAddonsResult);
        }
    }

    handleRefresh() {
        refreshApex(this.wiredAddonsResult);
        this.showToast('Refreshed', 'Add-on list updated', 'info');
    }

    handleImport() {
        this.showToast('Feature Coming Soon', 'CSV Import will be available in the next update.', 'info');
    }

    // --- View Settings ---

    toggleViewDropdown() {
        this.isViewDropdownOpen = !this.isViewDropdownOpen;
    }

    toggleColumn(event) {
        const colId = event.target.dataset.id;
        this.columns = this.columns.map(col => 
            col.id === colId ? { ...col, visible: event.target.checked } : col
        );
    }

    setDensityDefault() { this.density = 'default'; }
    setDensityCompact() { this.density = 'compact'; }

    resetViewSettings() {
        this.density = 'default';
        this.columns = this.columns.map(col => ({ ...col, visible: true }));
    }

    // --- Utils ---

    formatCurrency(value) {
        if (value === undefined || value === null) return '—';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    resetNewAddonForm() {
        this.newAddon = {
            name: '',
            description: '',
            billingUnit: 'Each',
            price: 0,
            cost: 0,
            tags: '',
            active: true,
            city: '',
            state: '',
            country: ''
        };
    }
}
