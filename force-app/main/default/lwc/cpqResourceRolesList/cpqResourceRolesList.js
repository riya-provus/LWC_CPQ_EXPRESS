import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getResourceRoles from '@salesforce/apex/ResourceRoleController.getResourceRoles';
import deleteResourceRole from '@salesforce/apex/ResourceRoleController.deleteResourceRole';
import toggleResourceRoleActive from '@salesforce/apex/ResourceRoleController.toggleResourceRoleActive';
import createResourceRole from '@salesforce/apex/ResourceRoleController.createResourceRole';

export default class CpqResourceRolesList extends LightningElement {
    @track roles = [];
    @track searchTerm = '';
    @track selectedStatus = 'All Status';
    @track isStatusDropdownOpen = false;
    @track isViewDropdownOpen = false;
    @track isLoading = false;
    @track isModalOpen = false;
    @track isCreating = false;
    @track isCompactView = false;
    @track charCount = 0;

    @track newRole = {
        name: '',
        description: '',
        price: 0,
        cost: 0,
        billingUnit: 'Hour',
        city: '',
        state: '',
        country: '',
        active: true
    };

    @track columns = [
        { id: 'hash', label: '#', visible: true, locked: true },
        { id: 'id', label: 'ID', visible: true, locked: false },
        { id: 'name', label: 'Name', visible: true, locked: false },
        { id: 'location', label: 'Location', visible: true, locked: false },
        { id: 'unit', label: 'Billing Unit', visible: true, locked: false },
        { id: 'price', label: 'Price', visible: true, locked: false },
        { id: 'cost', label: 'Cost', visible: true, locked: false },
        { id: 'active', label: 'Active', visible: true, locked: false }
    ];

    _wiredRolesResult;

    @wire(getResourceRoles)
    wiredRoles(result) {
        this._wiredRolesResult = result;
        if (result.data) {
            this.roles = result.data;
        } else if (result.error) {
            console.error(result.error);
        }
    }

    // ── Getters & Computed ──────────────────────────────────────────────────────

    get filteredRoles() {
        if (!this.roles) return [];

        let filtered = this.roles.filter(role => {
            const matchesSearch = !this.searchTerm || 
                (role.Name && role.Name.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (role.Role_ID__c && role.Role_ID__c.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (role.Location__c && role.Location__c.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (role.City__c && role.City__c.toLowerCase().includes(this.searchTerm.toLowerCase()));
            
            const matchesStatus = this.selectedStatus === 'All Status' || 
                (this.selectedStatus === 'Active' && role.Active__c) ||
                (this.selectedStatus === 'Inactive' && !role.Active__c);

            return matchesSearch && matchesStatus;
        });

        return filtered.map((role, index) => {
            const price = role.Price__c || 0;
            const cost = role.Cost__c || 0;
            const locationParts = [];
            if (role.City__c) locationParts.push(role.City__c);
            if (role.State__c) locationParts.push(role.State__c);
            if (role.Country__c) locationParts.push(role.Country__c);
            
            return {
                ...role,
                indexNumber: index + 1,
                recordUrl: `/lightning/r/Resource_Role__c/${role.Id}/view`,
                formattedPrice: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price),
                formattedCost: cost ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cost) : '—',
                displayLocation: locationParts.length > 0 ? locationParts.join(', ') : '—'
            };
        });
    }

    get totalCount() { return this.filteredRoles.length; }
    get hasRoles() { return this.totalCount > 0; }
    get startIndex() { return this.totalCount > 0 ? 1 : 0; }
    get endIndex() { return this.totalCount; }

    get tableClass() { return this.isCompactView ? 'roles-table compact' : 'roles-table'; }
    get densityDefaultClass() { return !this.isCompactView ? 'density-btn active' : 'density-btn'; }
    get densityCompactClass() { return this.isCompactView ? 'density-btn active' : 'density-btn'; }
    get visibleColumnCount() { return this.columns.filter(c => c.visible).length; }

    get showHash() { return this.columns.find(c => c.id === 'hash').visible; }
    get showId() { return this.columns.find(c => c.id === 'id').visible; }
    get showName() { return this.columns.find(c => c.id === 'name').visible; }
    get showLocation() { return this.columns.find(c => c.id === 'location').visible; }
    get showBillingUnit() { return this.columns.find(c => c.id === 'unit').visible; }
    get showPrice() { return this.columns.find(c => c.id === 'price').visible; }
    get showCost() { return this.columns.find(c => c.id === 'cost').visible; }
    get showActive() { return this.columns.find(c => c.id === 'active').visible; }

    // ── Modal Handlers ───────────────────────────────────────────────────────

    openModal() {
        this.isModalOpen = true;
        this.resetNewRole();
    }

    closeModal() {
        this.isModalOpen = false;
    }

    resetNewRole() {
        this.newRole = {
            name: '', description: '', price: 0, cost: 0,
            billingUnit: 'Hour', city: '', state: '', country: '', active: true
        };
        this.charCount = 0;
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        this.newRole = { ...this.newRole, [field]: event.target.value };
    }

    handleDescInput(event) {
        this.newRole.description = event.target.value;
        this.charCount = event.target.value.length;
    }

    handleActiveToggle(event) {
        this.newRole.active = event.target.checked;
    }

    async handleCreate() {
        if (!this.newRole.name || !this.newRole.billingUnit) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Please fill in all required fields.',
                variant: 'error'
            }));
            return;
        }

        this.isCreating = true;
        try {
            await createResourceRole({
                name: this.newRole.name,
                description: this.newRole.description,
                price: parseFloat(this.newRole.price),
                cost: parseFloat(this.newRole.cost),
                billingUnit: this.newRole.billingUnit,
                city: this.newRole.city,
                state: this.newRole.state,
                country: this.newRole.country,
                active: this.newRole.active
            });

            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Resource Role created successfully.',
                variant: 'success'
            }));
            this.isModalOpen = false;
            await refreshApex(this._wiredRolesResult);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error creating role',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        } finally {
            this.isCreating = false;
        }
    }

    // ── Table Settings Handlers ──────────────────────────────────────────────

    toggleViewDropdown() { this.isViewDropdownOpen = !this.isViewDropdownOpen; }
    setDensityDefault() { this.isCompactView = false; }
    setDensityCompact() { this.isCompactView = true; }

    handleColumnToggle(event) {
        const colId = event.target.dataset.id;
        this.columns = this.columns.map(col => {
            if (col.id === colId) return { ...col, visible: event.target.checked };
            return col;
        });
    }

    resetView() {
        this.isCompactView = false;
        this.columns = this.columns.map(col => ({ ...col, visible: true }));
    }

    // ── Other Handlers ───────────────────────────────────────────────────────

    handleSearch(event) { this.searchTerm = event.target.value; }
    toggleStatusDropdown() { this.isStatusDropdownOpen = !this.isStatusDropdownOpen; }
    handleStatusSelect(event) {
        this.selectedStatus = event.currentTarget.dataset.value;
        this.isStatusDropdownOpen = false;
    }

    async handleToggleActive(event) {
        const roleId = event.target.dataset.id;
        const isActive = event.target.checked;
        try {
            await toggleResourceRoleActive({ roleId, active: isActive });
            await refreshApex(this._wiredRolesResult);
        } catch (error) {
            console.error(error);
        }
    }

    async handleDelete(event) {
        const roleId = event.currentTarget.dataset.id;
        if (!confirm('Are you sure you want to delete this resource role?')) return;
        this.isLoading = true;
        try {
            await deleteResourceRole({ roleId });
            await refreshApex(this._wiredRolesResult);
        } catch (error) {
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    refreshData() {
        this.isLoading = true;
        refreshApex(this._wiredRolesResult).finally(() => { this.isLoading = false; });
    }

    stopProp(event) { event.stopPropagation(); }
}
