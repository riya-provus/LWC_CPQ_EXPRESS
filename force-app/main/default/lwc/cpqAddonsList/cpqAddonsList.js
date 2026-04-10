import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAddons from '@salesforce/apex/AddonListController.getAddons';
import createAddon from '@salesforce/apex/AddonListController.createAddon';
import updateAddon from '@salesforce/apex/AddonListController.updateAddon';
import deleteAddon from '@salesforce/apex/AddonListController.deleteAddon';
import toggleAddonActive from '@salesforce/apex/AddonListController.toggleAddonActive';
import getCurrentUserRole from '@salesforce/apex/CPQAdminController.getCurrentUserRole';

const LS_KEY = 'cpqAddonsListViewSettings';

export default class CpqAddonsList extends LightningElement {
    @track addons = [];
    @track filteredAddons = [];
    @track isModalOpen = false;
    @track isViewDropdownOpen = false;
    @track searchTerm = '';
    @track density = 'default';
    @track isEditMode = false;
    @track currentAddonId = null;
    isListenerAdded = false;
    
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

    @track currentUserRole = 'User';

    @wire(getCurrentUserRole)
    wiredUserRole({ error, data }) {
        if (data) {
            this.currentUserRole = data;
        }
    }

    get canCreate() {
        return this.currentUserRole !== 'User';
    }

    wiredAddonsResult;

    connectedCallback() {
        this.loadViewSettings();
    }

    @wire(getAddons)
    wiredAddons(result) {
        this.wiredAddonsResult = result;
        if (result.data) {
            this.addons = result.data.map((addon, index) => ({
                ...addon,
                counter: index + 1,
                recordUrl: `/lightning/r/CPQ_Addon__c/${addon.Id}/view`,
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

    get modalTitle() {
        return this.isEditMode ? 'Edit Add-on' : 'Create New Add-on';
    }

    get saveBtnLabel() {
        return this.isEditMode ? (this.isCreating ? 'Updating...' : 'Update') : (this.isCreating ? 'Creating...' : 'Create');
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
        this.isEditMode = false;
        this.currentAddonId = null;
        this.resetNewAddonForm();
        this.isModalOpen = true;
    }

    handleEdit(event) {
        event.preventDefault();
        const addonId = event.currentTarget.dataset.id;
        const addon = this.addons.find(a => a.Id === addonId);
        if (addon) {
            this.isEditMode = true;
            this.currentAddonId = addonId;
            this.newAddon = {
                name: addon.Name,
                description: addon.Description__c || '',
                billingUnit: addon.Billing_Unit__c,
                price: addon.Price__c,
                cost: addon.Cost__c || 0,
                tags: addon.Tags__c || '',
                active: addon.Active__c,
                city: addon.City__c || '',
                state: addon.State__c || '',
                country: addon.Country__c || ''
            };
            this.isModalOpen = true;
        }
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
            if (this.isEditMode) {
                await updateAddon({
                    addonId: this.currentAddonId,
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
                this.showToast('Success', 'Add-on updated successfully', 'success');
            } else {
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
            }
            this.isModalOpen = false;
            await refreshApex(this.wiredAddonsResult);
        } catch (error) {
            this.showToast('Error', error.body.message, 'error');
        } finally {
            this.isCreating = false;
        }
    }

    handleAIAssistant() {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Feature Coming Soon',
            message: 'Our Einstein-powered AI assistant is currently being finalized. Stay tuned for intelligent add-on recommendations and insights!',
            variant: 'info'
        }));
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

    loadViewSettings() {
        try {
            const saved = window.localStorage.getItem(LS_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.density) this.density = data.density;
                if (data.columns && Array.isArray(data.columns)) {
                    this.columns = this.columns.map(col => {
                        const savedCol = data.columns.find(c => c.id === col.id);
                        if (savedCol) col.visible = savedCol.visible;
                        return col;
                    });
                }
            }
        } catch(e) {}
    }

    saveViewSettings() {
        try {
            window.localStorage.setItem(LS_KEY, JSON.stringify({
                density: this.density,
                columns: this.columns.map(c => ({ id: c.id, visible: c.visible }))
            }));
        } catch(e) {}
    }

    toggleViewDropdown(event) {
        if (event) event.stopPropagation();
        this.isViewDropdownOpen = !this.isViewDropdownOpen;
    }

    renderedCallback() {
        if (!this.isListenerAdded) {
            this.clickListener = (event) => {
                const viewDropdown = this.template.querySelector('.view-settings-container');
                const isClickInsideView = viewDropdown && viewDropdown.contains(event.target);
                if (!isClickInsideView) this.isViewDropdownOpen = false;
            };
            document.addEventListener('click', this.clickListener);
            this.isListenerAdded = true;
        }
    }

    disconnectedCallback() {
        if (this.clickListener) {
            document.removeEventListener('click', this.clickListener);
        }
    }

    toggleColumn(event) {
        const colId = event.target.dataset.id;
        this.columns = this.columns.map(col => 
            col.id === colId ? { ...col, visible: event.target.checked } : col
        );
        this.saveViewSettings();
    }

    setDensityDefault() { this.density = 'default'; this.saveViewSettings(); }
    setDensityCompact() { this.density = 'compact'; this.saveViewSettings(); }

    resetViewSettings() {
        this.density = 'default';
        this.columns = this.columns.map(col => ({ ...col, visible: true }));
        this.saveViewSettings();
    }

    // --- Utils ---

    formatCurrency(value) {
        if (value === undefined || value === null) return '—';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
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
