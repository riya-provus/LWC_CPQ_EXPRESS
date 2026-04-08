import { LightningElement, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAllQuotes from '@salesforce/apex/QuotesListController.getAllQuotes';
import getAccounts from '@salesforce/apex/QuotesListController.getAccounts';
import getOpportunities from '@salesforce/apex/QuotesListController.getOpportunities';
import createQuote from '@salesforce/apex/QuotesListController.createQuote';
import deleteQuote from '@salesforce/apex/QuotesListController.deleteQuote';
import cloneQuote from '@salesforce/apex/QuotesListController.cloneQuote';

const LS_KEY = 'cpqQuotesListViewSettings';

export default class CpqQuotesList extends LightningElement {
    @track quotes = [];
    @track errorMsg = '';
    @track selectedStatus = 'All';
    @track isStatusDropdownOpen = false;
    @track isViewDropdownOpen = false;
    @track isAccountDropdownOpen = false;
    @track density = 'Default';
    @track accounts = [];
    @track opportunities = [];
    @track selectedAccountId = '';
    @track selectedAccountName = 'All Accounts';
    @track searchTerm = '';

    // New Quote Modal state
    @track showNewQuoteModal = false;
    @track newQuote = {
        opportunityId: '',
        accountId: '',
        description: '',
        startDate: '',
        endDate: '',
        timePeriod: 'Months'
    };
    @track isCreating = false;
    @track createError = '';
    @track charCount = 0;
    @track isOppDropdownOpen = false;
    @track isModalAccountDropdownOpen = false;

    // Wired results for refresh
    _wiredQuotesResult;
    _wiredAccountsResult;
    _wiredOpportunitiesResult;

    @track columns = [
        { id: 'hash', label: '#', visible: true, locked: true },
        { id: 'id', label: 'ID', visible: true, locked: false },
        { id: 'opportunity', label: 'Opportunity', visible: true, locked: false },
        { id: 'account', label: 'Account', visible: true, locked: false },
        { id: 'status', label: 'Status', visible: true, locked: false },
        { id: 'createdBy', label: 'Created By', visible: true, locked: false },
        { id: 'createdDate', label: 'Created Date', visible: true, locked: false },
        { id: 'totalAmount', label: 'Total Amount', visible: true, locked: false },
        { id: 'discount', label: 'Discount %', visible: true, locked: false },
        { id: 'margin', label: 'Margin %', visible: true, locked: false }
    ];

    // ── Wire Services ──────────────────────────────────────────────────────────

    @wire(getAllQuotes)
    wiredQuotes(result) {
        this._wiredQuotesResult = result;
        const { error, data } = result;
        if (data) {
            this.quotes = data.map(q => ({
                ...q,
                OpportunityName: q.Opportunity ? q.Opportunity.Name : 'N/A',
                AccountName: q.Account ? q.Account.Name : (q.Opportunity && q.Opportunity.Account ? q.Opportunity.Account.Name : 'N/A'),
                CreatedByName: q.CreatedBy ? q.CreatedBy.Name : 'N/A'
            }));
            this.errorMsg = '';
        } else if (error) {
            this.errorMsg = error.body ? error.body.message : JSON.stringify(error);
        }
    }

    @wire(getAccounts)
    wiredAccounts(result) {
        this._wiredAccountsResult = result;
        if (result.data) this.accounts = result.data;
    }

    @wire(getOpportunities)
    wiredOpportunities(result) {
        this._wiredOpportunitiesResult = result;
        if (result.data) this.opportunities = result.data;
    }

    // ── Status Filter ──────────────────────────────────────────────────────────

    toggleStatusDropdown() { this.isStatusDropdownOpen = !this.isStatusDropdownOpen; }

    handleStatusSelect(event) {
        this.selectedStatus = event.currentTarget.dataset.value;
        this.isStatusDropdownOpen = false;
    }

    get dropdownLabel() { return this.selectedStatus === 'All' ? 'All Status' : this.selectedStatus; }
    get isStatusAll() { return this.selectedStatus === 'All'; }
    get isStatusDraft() { return this.selectedStatus === 'Draft'; }
    get isStatusPending() { return this.selectedStatus === 'Pending Approval'; }
    get isStatusApproved() { return this.selectedStatus === 'Approved'; }
    get isStatusRejected() { return this.selectedStatus === 'Rejected'; }

    // ── Account Filter ─────────────────────────────────────────────────────────

    toggleAccountDropdown() { this.isAccountDropdownOpen = !this.isAccountDropdownOpen; }

    handleAccountSelect(event) {
        this.selectedAccountId = event.currentTarget.dataset.id;
        this.selectedAccountName = event.currentTarget.dataset.name;
        this.isAccountDropdownOpen = false;
    }

    clearAccountFilter() {
        this.selectedAccountId = '';
        this.selectedAccountName = 'All Accounts';
        this.isAccountDropdownOpen = false;
    }

    get accountDropdownLabel() { return this.selectedAccountName; }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    // ── View Settings ──────────────────────────────────────────────────────────

    loadViewSettings() {
        try {
            const saved = window.localStorage.getItem(LS_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.density) this.density = data.density;
                if (data.columns && Array.isArray(data.columns)) {
                    this.columns = this.columns.map(col => {
                        const savedCol = data.columns.find(c => c.id === col.id);
                        if (savedCol && !col.locked) col.visible = savedCol.visible;
                        return col;
                    });
                }
            }
        } catch(e) { console.error('Error loading view settings', e); }
    }

    saveViewSettings() {
        try {
            window.localStorage.setItem(LS_KEY, JSON.stringify({
                density: this.density,
                columns: this.columns.map(c => ({ id: c.id, visible: c.visible }))
            }));
        } catch(e) { console.error('Error saving view settings', e); }
    }

    toggleViewDropdown() { this.isViewDropdownOpen = !this.isViewDropdownOpen; }
    get densityDefaultClass() { return this.density === 'Default' ? 'density-btn active' : 'density-btn'; }
    get densityCompactClass() { return this.density === 'Compact' ? 'density-btn active' : 'density-btn'; }
    setDensityDefault() { this.density = 'Default'; this.saveViewSettings(); }
    setDensityCompact() { this.density = 'Compact'; this.saveViewSettings(); }

    handleColumnToggle(event) {
        const colId = event.target.dataset.id;
        const checked = event.target.checked;
        const colIndex = this.columns.findIndex(c => c.id === colId);
        if (colIndex > -1 && !this.columns[colIndex].locked) {
            this.columns[colIndex].visible = checked;
            this.saveViewSettings();
        }
    }

    resetView() { this.density = 'Default'; this.columns.forEach(c => c.visible = true); this.saveViewSettings(); }
    selectAllColumns() { this.columns.forEach(c => c.visible = true); this.saveViewSettings(); }

    get visibleColumnsCount() { return this.columns.filter(c => c.visible).length; }
    get tableDensityClass() { return this.density === 'Compact' ? 'quotes-table compact' : 'quotes-table'; }

    // Column visibility
    get showHash() { return this.columns.find(c => c.id === 'hash').visible; }
    get showId() { return this.columns.find(c => c.id === 'id').visible; }
    get showOpportunity() { return this.columns.find(c => c.id === 'opportunity').visible; }
    get showAccount() { return this.columns.find(c => c.id === 'account').visible; }
    get showStatus() { return this.columns.find(c => c.id === 'status').visible; }
    get showCreatedBy() { return this.columns.find(c => c.id === 'createdBy').visible; }
    get showCreatedDate() { return this.columns.find(c => c.id === 'createdDate').visible; }
    get showTotalAmount() { return this.columns.find(c => c.id === 'totalAmount').visible; }
    get showDiscount() { return this.columns.find(c => c.id === 'discount').visible; }
    get showMargin() { return this.columns.find(c => c.id === 'margin').visible; }

    // ── Table Data ─────────────────────────────────────────────────────────────

    get quotesCount() {
        return this.processedQuotes.length;
    }

    get processedQuotes() {
        if (!this.quotes || this.quotes.length === 0) return [];

        let filtered = [...this.quotes];

        // Status filter
        if (this.selectedStatus !== 'All') {
            filtered = filtered.filter(q => q.Status === this.selectedStatus);
        }

        // Account filter
        if (this.selectedAccountId) {
            filtered = filtered.filter(q => {
                const accId = q.AccountId || (q.Opportunity && q.Opportunity.AccountId);
                return accId === this.selectedAccountId;
            });
        }

        // Search filter
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(q => {
                return (q.QuoteNumber && q.QuoteNumber.toLowerCase().includes(term)) ||
                       (q.OpportunityName && q.OpportunityName.toLowerCase().includes(term)) ||
                       (q.AccountName && q.AccountName.toLowerCase().includes(term));
            });
        }

        return filtered.map((q, idx) => {
            let statusClass = 'badge-draft';
            if (q.Status === 'Approved') statusClass = 'badge-approved';
            else if (q.Status === 'Rejected') statusClass = 'badge-rejected';
            else if (q.Status === 'Pending Approval' || q.Status === 'Needs Review' || q.Status === 'In Review') statusClass = 'badge-review';

            return {
                ...q,
                indexNumber: idx + 1,
                recordUrl: '/' + q.Id,
                formattedCreatedDate: q.CreatedDate ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(q.CreatedDate)) : '',
                formattedAmount: q.Total_Amount__c != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(q.Total_Amount__c) : '$0.00',
                formattedDiscount: q.Discount__c != null ? `${q.Discount__c}%` : '0%',
                formattedMargin: q.Margin_Percentage__c != null ? `${q.Margin_Percentage__c}%` : '0%',
                statusClass: statusClass
            };
        });
    }

    // ── New Quote Modal ────────────────────────────────────────────────────────
    
    connectedCallback() {
        this.loadViewSettings();
        this.handleRefresh();
    }

    async handleRefresh() {
        const promises = [];
        if (this._wiredQuotesResult) promises.push(refreshApex(this._wiredQuotesResult));
        if (this._wiredAccountsResult) promises.push(refreshApex(this._wiredAccountsResult));
        if (this._wiredOpportunitiesResult) promises.push(refreshApex(this._wiredOpportunitiesResult));
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    handleNewQuote() {
        const today = new Date().toISOString().split('T')[0];
        this.newQuote = {
            opportunityId: '',
            accountId: '',
            description: '',
            startDate: today,
            endDate: '',
            timePeriod: 'Months'
        };
        this.charCount = 0;
        this.createError = '';
        this.showNewQuoteModal = true;
        this.isOppDropdownOpen = false;
        this.isModalAccountDropdownOpen = false;
    }

    closeModal() {
        this.showNewQuoteModal = false;
        this.createError = '';
    }

    // Prevent clicks inside modal from closing it
    stopProp(event) {
        event.stopPropagation();
    }

    // LWC @track doesn't deeply track nested property mutations
    // We must spread a NEW object to trigger re-renders
    handleDescriptionChange(event) {
        const val = event.target.value;
        this.charCount = val.length;
        this.newQuote = { ...this.newQuote, description: val };
    }

    handleStartDateChange(event) {
        this.newQuote = { ...this.newQuote, startDate: event.target.value };
    }
    handleEndDateChange(event) {
        this.newQuote = { ...this.newQuote, endDate: event.target.value };
    }
    handleTimePeriodChange(event) {
        this.newQuote = { ...this.newQuote, timePeriod: event.target.value };
    }

    // Modal Opportunity dropdown
    toggleOppDropdown() { this.isOppDropdownOpen = !this.isOppDropdownOpen; }

    // Filter opportunities by the selected account (in modal)
    get filteredOpportunities() {
        if (!this.opportunities) return [];
        if (!this.newQuote.accountId) return this.opportunities;
        return this.opportunities.filter(o => o.AccountId === this.newQuote.accountId);
    }

    get selectedOppLabel() {
        if (!this.newQuote.opportunityId) return 'Select an opportunity (optional)...';
        const opp = this.opportunities.find(o => o.Id === this.newQuote.opportunityId);
        return opp ? opp.Name : 'Select an opportunity (optional)...';
    }

    handleOppSelect(event) {
        const oppId = event.currentTarget.dataset.id;
        const opp = this.opportunities.find(o => o.Id === oppId);
        // Auto-fill account from the selected opportunity
        const autoAccId = (opp && opp.AccountId) ? opp.AccountId : this.newQuote.accountId;
        this.newQuote = { ...this.newQuote, opportunityId: oppId, accountId: autoAccId };
        this.isOppDropdownOpen = false;
    }

    clearOppSelection() {
        this.newQuote = { ...this.newQuote, opportunityId: '' };
        this.isOppDropdownOpen = false;
    }

    // Modal Account dropdown
    toggleModalAccountDropdown() { this.isModalAccountDropdownOpen = !this.isModalAccountDropdownOpen; }

    get selectedModalAccountLabel() {
        if (!this.newQuote.accountId) return 'Select an account...';
        const acc = this.accounts.find(a => a.Id === this.newQuote.accountId);
        return acc ? acc.Name : 'Select an account...';
    }

    handleModalAccountSelect(event) {
        const accId = event.currentTarget.dataset.id;
        // Clear opportunity if it belongs to a different account
        const currentOpp = this.opportunities.find(o => o.Id === this.newQuote.opportunityId);
        const clearOpp = currentOpp && currentOpp.AccountId !== accId;
        this.newQuote = {
            ...this.newQuote,
            accountId: accId,
            opportunityId: clearOpp ? '' : this.newQuote.opportunityId
        };
        this.isModalAccountDropdownOpen = false;
    }

    async handleCreateQuote() {
        // Require at least an Account or an Opportunity
        if (!this.newQuote.accountId && !this.newQuote.opportunityId) {
            this.createError = 'Please select at least an Account or an Opportunity.';
            return;
        }
        this.isCreating = true;
        this.createError = '';
        try {
            const newQuoteId = await createQuote({
                opportunityId: this.newQuote.opportunityId || null,
                accountId: this.newQuote.accountId || null,
                description: this.newQuote.description || null,
                startDate: null,
                endDate: this.newQuote.endDate || null,
                timePeriod: this.newQuote.timePeriod || null
            });
            this.showNewQuoteModal = false;
            // Navigate directly to the new quote's explorer page
            if (newQuoteId) {
                this.dispatchEvent(new CustomEvent('quoteclick', {
                    detail: { quoteId: newQuoteId }
                }));
            } else {
                await refreshApex(this._wiredQuotesResult);
            }
        } catch (e) {
            this.createError = e.body ? e.body.message : 'Error creating quote.';
        } finally {
            this.isCreating = false;
        }
    }

    async handleDelete(event) {
        const quoteId = event.currentTarget.dataset.id;
        if (!confirm('Are you sure you want to delete this quote?')) return;
        
        try {
            await deleteQuote({ quoteId });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Quote deleted successfully',
                variant: 'success'
            }));
            await refreshApex(this._wiredQuotesResult);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error deleting quote',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        }
    }

    async handleClone(event) {
        const quoteId = event.currentTarget.dataset.id;
        try {
            await cloneQuote({ quoteId });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Quote cloned successfully as Draft',
                variant: 'success'
            }));
            await refreshApex(this._wiredQuotesResult);
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error cloning quote',
                message: error.body ? error.body.message : error.message,
                variant: 'error'
            }));
        }
    }

    handleQuoteClick(event) {
        event.preventDefault();
        const quoteId = event.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('quoteclick', {
            detail: { quoteId: quoteId }
        }));
    }
}