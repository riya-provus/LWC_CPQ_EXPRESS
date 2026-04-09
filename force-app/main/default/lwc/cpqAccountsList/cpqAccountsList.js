import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAccountsDetailed from '@salesforce/apex/AccountListController.getAccountsDetailed';
import getAccountFilters from '@salesforce/apex/AccountListController.getAccountFilters';
import deleteAccount from '@salesforce/apex/AccountListController.deleteAccount';
import createAccount from '@salesforce/apex/AccountListController.createAccount';
import updateAccount from '@salesforce/apex/AccountListController.updateAccount';
import getCurrentUserRole from '@salesforce/apex/CPQAdminController.getCurrentUserRole';

export default class CpqAccountsList extends NavigationMixin(LightningElement) {
    @track accounts = [];
    @track typeOptions = [];
    @track industryOptions = [];
    
    @track searchTerm = '';
    @track selectedType = 'All Types';
    @track selectedIndustry = 'All Industries';
    
    @track showNewAccountModal = false;
    @track newAccount = {
        Name: '',
        Type: 'None',
        Industry: 'None',
        Phone: '',
        Website: ''
    };

    @track isTypeDropdownOpen = false;
    @track isIndustryDropdownOpen = false;
    @track isLoading = false;
    @track userRole = 'User';
    @track isEditMode = false;
    @track currentAccountId = null;
    isListenerAdded = false;

    @wire(getCurrentUserRole)
    wiredRole({data}) { if (data) this.userRole = data; }

    get isAdmin() { return this.userRole === 'Admin'; }

    _wiredAccountsResult;
    _wiredFiltersResult;

    @wire(getAccountsDetailed)
    wiredAccounts(result) {
        this._wiredAccountsResult = result;
        if (result.data) {
            this.accounts = result.data;
        } else if (result.error) {
            console.error(result.error);
        }
    }

    @wire(getAccountFilters)
    wiredFilters(result) {
        this._wiredFiltersResult = result;
        if (result.data) {
            this.typeOptions = result.data.Type || [];
            this.industryOptions = result.data.Industry || [];
        } else if (result.error) {
            console.error(result.error);
        }
    }

    // ── Getters & Computed ──────────────────────────────────────────────────────

    get filteredAccounts() {
        if (!this.accounts) return [];

        let filtered = this.accounts.filter(acc => {
            const matchesSearch = !this.searchTerm || 
                (acc.Name && acc.Name.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (acc.Phone && acc.Phone.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                (acc.AccountNumber && acc.AccountNumber.toLowerCase().includes(this.searchTerm.toLowerCase()));
            
            const matchesType = this.selectedType === 'All Types' || acc.Type === this.selectedType;
            const matchesIndustry = this.selectedIndustry === 'All Industries' || acc.Industry === this.selectedIndustry;

            return matchesSearch && matchesType && matchesIndustry;
        });

        return filtered.map((acc, index) => {
            let typeClass = 'type-badge';
            if (acc.Type === 'Customer - Direct' || acc.Type === 'Customer - Channel') typeClass += ' badge-customer';
            else if (acc.Type === 'Prospect') typeClass += ' badge-prospect';

            return {
                ...acc,
                indexNumber: index + 1,
                recordUrl: `/lightning/r/Account/${acc.Id}/view`,
                typeClass: typeClass
            };
        });
    }

    get totalCount() { return this.filteredAccounts.length; }
    get hasAccounts() { return this.totalCount > 0; }
    get startIndex() { return this.totalCount > 0 ? 1 : 0; }
    get endIndex() { return this.totalCount; }

    get modalTitle() { return this.isEditMode ? 'Edit Account' : 'Create New Account'; }
    get saveBtnLabel() { return this.isEditMode ? (this.isLoading ? 'Updating...' : 'Update') : (this.isLoading ? 'Creating...' : 'Create'); }

    // ── Handlers ───────────────────────────────────────────────────────────────

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    toggleTypeDropdown(event) { 
        event.stopPropagation();
        this.isTypeDropdownOpen = !this.isTypeDropdownOpen; 
        this.isIndustryDropdownOpen = false; 
    }
    toggleIndustryDropdown(event) { 
        event.stopPropagation();
        this.isIndustryDropdownOpen = !this.isIndustryDropdownOpen; 
        this.isTypeDropdownOpen = false; 
    }

    renderedCallback() {
        if (!this.isListenerAdded) {
            this.clickListener = (event) => {
                const typeDropdown = this.template.querySelector('.type-dropdown-container');
                const industryDropdown = this.template.querySelector('.industry-dropdown-container');
                
                const isClickInsideType = typeDropdown && typeDropdown.contains(event.target);
                const isClickInsideIndustry = industryDropdown && industryDropdown.contains(event.target);

                if (!isClickInsideType) this.isTypeDropdownOpen = false;
                if (!isClickInsideIndustry) this.isIndustryDropdownOpen = false;
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

    stopProp(event) {
        event.stopPropagation();
    }

    handleTypeSelect(event) {
        this.selectedType = event.currentTarget.dataset.value;
        this.isTypeDropdownOpen = false;
    }

    handleIndustrySelect(event) {
        this.selectedIndustry = event.currentTarget.dataset.value;
        this.isIndustryDropdownOpen = false;
    }

    handleNewAccount() {
        this.isEditMode = false;
        this.currentAccountId = null;
        this.newAccount = { Name: '', Type: 'None', Industry: 'None', Phone: '', Website: '' };
        this.showNewAccountModal = true;
    }

    handleEditAccount(event) {
        event.preventDefault();
        const accId = event.currentTarget.dataset.id;
        const acc = this.accounts.find(a => a.Id === accId);
        if (acc) {
            this.isEditMode = true;
            this.currentAccountId = accId;
            this.newAccount = {
                Name: acc.Name,
                Type: acc.Type || 'None',
                Industry: acc.Industry || 'None',
                Phone: acc.Phone || '',
                Website: acc.Website || ''
            };
            this.showNewAccountModal = true;
        }
    }

    closeModal() {
        this.showNewAccountModal = false;
    }

    handleInputChange(event) {
        const field = event.target.dataset.field;
        this.newAccount = { ...this.newAccount, [field]: event.target.value };
    }

    handleSaveAccount() {
        if (!this.newAccount.Name) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Account Name is required',
                variant: 'error'
            }));
            return;
        }

        this.isLoading = true;

        const saveAction = this.isEditMode ? 
            updateAccount({
                accountId: this.currentAccountId,
                name: this.newAccount.Name,
                type: this.newAccount.Type,
                industry: this.newAccount.Industry,
                phone: this.newAccount.Phone,
                website: this.newAccount.Website
            }) :
            createAccount({ 
                name: this.newAccount.Name,
                type: this.newAccount.Type,
                industry: this.newAccount.Industry,
                phone: this.newAccount.Phone,
                website: this.newAccount.Website
            });

        saveAction
            .then(() => {
                const msg = this.isEditMode ? 'Account updated successfully' : 'Account created successfully';
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: msg,
                    variant: 'success'
                }));
                this.showNewAccountModal = false;
                return refreshApex(this._wiredAccountsResult);
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body.message,
                    variant: 'error'
                }));
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleAIAssistant() {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Feature Coming Soon',
            message: 'Our Einstein-powered AI assistant is currently being finalized. Stay tuned for intelligent account insights!',
            variant: 'info'
        }));
    }

    refreshData() {
        this.isLoading = true;
        const promises = [];
        if (this._wiredAccountsResult) promises.push(refreshApex(this._wiredAccountsResult));
        if (this._wiredFiltersResult) promises.push(refreshApex(this._wiredFiltersResult));
        Promise.all(promises).finally(() => { this.isLoading = false; });
    }

    handleDelete(event) {
        const accId = event.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this account?')) {
            deleteAccount({ accountId: accId })
                .then(() => {
                    this.dispatchEvent(new ShowToastEvent({
                        title: 'Success',
                        message: 'Account deleted',
                        variant: 'success'
                    }));
                    return refreshApex(this._wiredAccountsResult);
                })
                .catch(error => {
                    this.dispatchEvent(new ShowToastEvent({
                        title: 'Error',
                        message: error.body.message,
                        variant: 'error'
                    }));
                });
        }
    }
}
