import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getResourceRoles from '@salesforce/apex/ResourceRoleController.getResourceRoles';
import deleteResourceRole from '@salesforce/apex/ResourceRoleController.deleteResourceRole';
import toggleResourceRoleActive from '@salesforce/apex/ResourceRoleController.toggleResourceRoleActive';
import createResourceRole from '@salesforce/apex/ResourceRoleController.createResourceRole';
import updateResourceRole from '@salesforce/apex/ResourceRoleController.updateResourceRole';
import getCurrentUserRole from '@salesforce/apex/CPQAdminController.getCurrentUserRole';

const LS_KEY = 'cpqResourceRolesListViewSettings';

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
    @track isEditMode = false;
    @track currentRoleId = null;
    isListenerAdded = false;

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

    _wiredRolesResult;

    connectedCallback() {
        this.loadViewSettings();
    }

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

    get modalTitle() { return this.isEditMode ? 'Edit Resource Role' : 'Create New Resource Role'; }
    get saveBtnLabel() {
        return this.isEditMode ? (this.isCreating ? 'Updating...' : 'Update') : (this.isCreating ? 'Creating...' : 'Create');
    }

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
        this.isEditMode = false;
        this.currentRoleId = null;
        this.isModalOpen = true;
        this.resetNewRole();
    }

    handleEdit(event) {
        event.preventDefault();
        const roleId = event.currentTarget.dataset.id;
        const role = this.roles.find(r => r.Id === roleId);
        if (role) {
            this.isEditMode = true;
            this.currentRoleId = roleId;
            this.newRole = {
                name: role.Name,
                description: role.Description__c || '',
                price: role.Price__c,
                cost: role.Cost__c || 0,
                billingUnit: role.Billing_Unit__c,
                city: role.City__c || '',
                state: role.State__c || '',
                country: role.Country__c || '',
                active: role.Active__c
            };
            this.charCount = this.newRole.description.length;
            this.isModalOpen = true;
        }
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

    handleCreate() {
        if (!this.newRole.name || !this.newRole.billingUnit) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Please fill in all required fields.',
                variant: 'error'
            }));
            return;
        }

        this.isCreating = true;
        const action = this.isEditMode ? updateResourceRole : createResourceRole;
        const params = this.isEditMode ? { roleId: this.currentRoleId, ...this.newRole } : this.newRole;
        const msg = this.isEditMode ? 'Resource Role updated successfully.' : 'Resource Role created successfully.';

        action(params)
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: msg,
                    variant: 'success'
                }));
                this.closeModal();
                return refreshApex(this._wiredRolesResult);
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body ? error.body.message : error.message,
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.isCreating = false;
            });
    }

    handleAIAssistant() {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Feature Coming Soon',
            message: 'Our Einstein-powered AI assistant is currently being finalized. Stay tuned for intelligent resource optimization and insights!',
            variant: 'info'
        }));
    }

    // ── Table Settings Handlers ──────────────────────────────────────────────

    loadViewSettings() {
        try {
            const saved = window.localStorage.getItem(LS_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.isCompactView !== undefined) this.isCompactView = data.isCompactView;
                if (data.columns && Array.isArray(data.columns)) {
                    this.columns = this.columns.map(col => {
                        const savedCol = data.columns.find(c => c.id === col.id);
                        if (savedCol && !col.locked) col.visible = savedCol.visible;
                        return col;
                    });
                }
            }
        } catch(e) {}
    }

    saveViewSettings() {
        try {
            window.localStorage.setItem(LS_KEY, JSON.stringify({
                isCompactView: this.isCompactView,
                columns: this.columns.map(c => ({ id: c.id, visible: c.visible }))
            }));
        } catch(e) {}
    }

    toggleViewDropdown(event) { 
        if (event) event.stopPropagation();
        this.isViewDropdownOpen = !this.isViewDropdownOpen; 
        this.isStatusDropdownOpen = false;
    }

    renderedCallback() {
        if (!this.isListenerAdded) {
            this.clickListener = (event) => {
                const statusDropdown = this.template.querySelector('.status-dropdown-container');
                const viewDropdown = this.template.querySelector('.view-dropdown-container');
                
                const isClickInsideStatus = statusDropdown && statusDropdown.contains(event.target);
                const isClickInsideView = viewDropdown && viewDropdown.contains(event.target);

                if (!isClickInsideStatus) this.isStatusDropdownOpen = false;
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
    setDensityDefault() { this.isCompactView = false; this.saveViewSettings(); }
    setDensityCompact() { this.isCompactView = true; this.saveViewSettings(); }

    handleColumnToggle(event) {
        const colId = event.target.dataset.id;
        this.columns = this.columns.map(col => {
            if (col.id === colId && !col.locked) return { ...col, visible: event.target.checked };
            return col;
        });
        this.saveViewSettings();
    }

    resetView() {
        this.isCompactView = false;
        this.columns = this.columns.map(col => ({ ...col, visible: true }));
        this.saveViewSettings();
    }

    // ── Other Handlers ───────────────────────────────────────────────────────

    handleSearch(event) { this.searchTerm = event.target.value; }
    toggleStatusDropdown(event) { 
        if (event) event.stopPropagation();
        this.isStatusDropdownOpen = !this.isStatusDropdownOpen; 
        this.isViewDropdownOpen = false;
    }
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
