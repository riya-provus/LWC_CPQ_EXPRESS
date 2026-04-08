import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getAccountsDetailed from '@salesforce/apex/AccountListController.getAccountsDetailed';
import getAccountFilters from '@salesforce/apex/AccountListController.getAccountFilters';
import deleteAccount from '@salesforce/apex/AccountListController.deleteAccount';
import createAccount from '@salesforce/apex/AccountListController.createAccount';

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

    _wiredAccountsResult;

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
    wiredFilters({ data, error }) {
        if (data) {
            this.typeOptions = data.Type || [];
            this.industryOptions = data.Industry || [];
        } else if (error) {
            console.error(error);
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

    // ── Handlers ───────────────────────────────────────────────────────────────

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    toggleTypeDropdown() { this.isTypeDropdownOpen = !this.isTypeDropdownOpen; this.isIndustryDropdownOpen = false; }
    toggleIndustryDropdown() { this.isIndustryDropdownOpen = !this.isIndustryDropdownOpen; this.isTypeDropdownOpen = false; }

    handleTypeSelect(event) {
        this.selectedType = event.currentTarget.dataset.value;
        this.isTypeDropdownOpen = false;
    }

    handleIndustrySelect(event) {
        this.selectedIndustry = event.currentTarget.dataset.value;
        this.isIndustryDropdownOpen = false;
    }

    handleNewAccount() {
        this.newAccount = { Name: '', Type: 'None', Industry: 'None', Phone: '', Website: '' };
        this.showNewAccountModal = true;
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
        createAccount({ 
            name: this.newAccount.Name,
            type: this.newAccount.Type,
            industry: this.newAccount.Industry,
            phone: this.newAccount.Phone,
            website: this.newAccount.Website
        })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: 'Account created successfully',
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

    refreshData() {
        this.isLoading = true;
        refreshApex(this._wiredAccountsResult)
            .finally(() => { this.isLoading = false; });
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
