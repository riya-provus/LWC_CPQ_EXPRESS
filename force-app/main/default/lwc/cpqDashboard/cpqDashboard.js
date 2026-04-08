import { LightningElement, wire, track } from 'lwc';
import getDashboardData from '@salesforce/apex/CPQDashboardController.getDashboardData';
import getQuotesByStatus from '@salesforce/apex/CPQDashboardController.getQuotesByStatus';
import { NavigationMixin } from 'lightning/navigation';

export default class CpqDashboard extends NavigationMixin(LightningElement) {
    @track dashboardData = {};
    @track quotes = [];
    @track activeTab = 'All'; // Screenshot shows 'All' selected
    userName = '';
    
    @track currentView = 'Dashboard';
    @track selectedQuoteId = '';

    get isDashboardView() { return this.currentView === 'Dashboard'; }
    get isQuotesView() { return this.currentView === 'Quotes'; }
    get isAccountsView() { return this.currentView === 'Accounts'; }
    get isResourceRolesView() { return this.currentView === 'ResourceRoles'; }
    get isProductsView() { return this.currentView === 'Products'; }
    get isAddonsView() { return this.currentView === 'Addons'; }
    get isQuoteExplorerView() { return this.currentView === 'QuoteExplorer'; }

    get dashboardClass() { return this.currentView === 'Dashboard' ? 'active' : ''; }
    get dashboardIconClass() { return this.currentView === 'Dashboard' ? 'sidebar-icon-active' : 'sidebar-icon'; }
    
    get quotesClass() { return this.currentView === 'Quotes' ? 'active' : ''; }
    get quotesIconClass() { return this.currentView === 'Quotes' ? 'sidebar-icon-active' : 'sidebar-icon'; }

    get accountsClass() { return this.currentView === 'Accounts' ? 'active' : ''; }
    get accountsIconClass() { return this.currentView === 'Accounts' ? 'sidebar-icon-active' : 'sidebar-icon'; }

    get resourceRolesClass() { return this.currentView === 'ResourceRoles' ? 'active' : ''; }
    get resourceRolesIconClass() { return this.currentView === 'ResourceRoles' ? 'sidebar-icon-active' : 'sidebar-icon'; }

    get productsClass() { return this.currentView === 'Products' ? 'active' : ''; }
    get productsIconClass() { return this.currentView === 'Products' ? 'sidebar-icon-active' : 'sidebar-icon'; }

    get addonsClass() { return this.currentView === 'Addons' ? 'active' : ''; }
    get addonsIconClass() { return this.currentView === 'Addons' ? 'sidebar-icon-active' : 'sidebar-icon'; }

    handleSidebarNav(event) {
        this.currentView = event.currentTarget.dataset.target;
        this.selectedQuoteId = '';
    }

    handleQuoteClick(event) {
        this.selectedQuoteId = event.detail.quoteId;
        this.currentView = 'QuoteExplorer';
    }

    handleBackToList() {
        this.currentView = 'Quotes';
        this.selectedQuoteId = '';
    }
    
    // Derived formatted values for display
    get awaitingApprovalCount() { return this.dashboardData.awaitingApprovalCount !== undefined ? this.dashboardData.awaitingApprovalCount : 0; }
    get lowMarginCount() { return this.dashboardData.lowMarginCount !== undefined ? this.dashboardData.lowMarginCount : 0; }
    get lowMarginAmountStr() { return this.formatCurrency(this.dashboardData.lowMarginAmount !== undefined ? this.dashboardData.lowMarginAmount : 0); }
    get draftPipelineCount() { return this.dashboardData.draftPipelineCount !== undefined ? this.dashboardData.draftPipelineCount : 0; }
    get draftPipelineAmountStr() { return this.formatCurrency(this.dashboardData.draftPipelineAmount !== undefined ? this.dashboardData.draftPipelineAmount : 0); }
    get highMarginDealCount() { return this.dashboardData.highMarginDealCount !== undefined ? this.dashboardData.highMarginDealCount : 0; }
    get highMarginDealAmountStr() { return this.formatCurrency(this.dashboardData.highMarginDealAmount !== undefined ? this.dashboardData.highMarginDealAmount : 0); }
    get wonThisMonthCount() { return this.dashboardData.wonThisMonthCount !== undefined ? this.dashboardData.wonThisMonthCount : 0; }
    get wonThisMonthAmountStr() { return this.formatCurrency(this.dashboardData.wonThisMonthAmount !== undefined ? this.dashboardData.wonThisMonthAmount : 0); }

    get greeting() {
        const hour = new Date().getHours();
        let timeGreeting = 'Good evening';
        let emoji = '🌙';
        
        if (hour < 12) {
            timeGreeting = 'Good morning';
            emoji = '🌅';
        } else if (hour < 17) {
            timeGreeting = 'Good afternoon';
            emoji = '☀️';
        }
        
        const nameToDisplay = this.userName ? this.userName : 'User';
        return `${emoji} ${timeGreeting}, ${nameToDisplay}!`;
    }

    tabList = [
        { name: 'All' },
        { name: 'Draft' },
        { name: 'Pending' },
        { name: 'Approved' },
        { name: 'Rejected' }
    ];

    get tabs() {
        return this.tabList.map(tab => ({
            name: tab.name,
            class: tab.name === this.activeTab ? 'pill active' : 'pill'
        }));
    }

    @wire(getDashboardData)
    wiredData({ error, data }) {
        if (data && Object.keys(data).length > 0) {
            this.dashboardData = data;
            this.userName = data.userName;
        }
    }

    @wire(getQuotesByStatus, { status: '$activeTab' })
    wiredQuotes({ error, data }) {
        if (data) {
            this.quotes = data;
        }
    }

    get processedQuotes() {
        if (!this.quotes || this.quotes.length === 0) return [];
        return this.quotes.map(q => {
            return {
                ...q,
                formattedDate: this.calculateTimeAgo(q.LastModifiedDate),
                statusClass: this.getStatusClass(q.Status)
            };
        });
    }

    calculateTimeAgo(dateString) {
        if (!dateString) return '';
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now - past;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        return 'Just now';
    }

    getStatusClass(status) {
        if (status === 'Approved' || status === 'Accepted') return 'status-green';
        if (status === 'Rejected' || status === 'Denied') return 'status-red';
        if (status === 'Draft') return 'status-gray';
        return 'status-yellow';
    }

    get hasQuotes() {
        return this.quotes && this.quotes.length > 0;
    }

    get quoteListTitle() {
        if (this.activeTab === 'All') return 'Your Recent Quotes';
        return `Your ${this.activeTab} Quotes`;
    }

    get quotesTotalMessage() {
        const len = this.quotes ? this.quotes.length : 0;
        return `${len} quote${len !== 1 ? 's' : ''} total`;
    }

    get emptyStateMessage() {
        return `No ${this.activeTab.toLowerCase()} quotes found.`;
    }

    handleTabClick(event) {
        this.activeTab = event.currentTarget.dataset.tab;
    }

    formatCurrency(value) {
        if (value === undefined || value === null) return '$0';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
    }
    
    // Quick Actions
    handleCreateQuote() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName: 'Quote',
                actionName: 'new'
            }
        });
    }
}
