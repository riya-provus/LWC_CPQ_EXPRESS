public with sharing class CPQDashboardController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDashboardData() {
        Map<String, Object> result = new Map<String, Object>();
        
        try {
            // Get current user info
            User currentUser = [SELECT Id, Name FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            result.put('userName', currentUser.Name);
            
            // Insight 1: Awaiting Your Approval (Pending maps to Needs Review / In Review)
            Integer awaitingApprovalCount = [SELECT COUNT() FROM Quote WHERE Status IN ('Needs Review', 'In Review')];
            result.put('awaitingApprovalCount', awaitingApprovalCount);
            
            // Aggregate Queries for other insights
            AggregateResult[] draftStats = [SELECT COUNT(Id) draftCount, SUM(Total_Amount__c) draftAmount FROM Quote WHERE Status = 'Draft'];
            Integer draftCount = draftStats.isEmpty() || draftStats[0].get('draftCount') == null ? 0 : Integer.valueOf(draftStats[0].get('draftCount'));
            Decimal draftAmount = draftStats.isEmpty() || draftStats[0].get('draftAmount') == null ? 0.0 : (Decimal)draftStats[0].get('draftAmount');
            
            // Insight 3: Draft Pipeline
            result.put('draftPipelineCount', draftCount);
            result.put('draftPipelineAmount', draftAmount);

            // Insight 2: Low Margin Drafts (Margin < 15%)
            Integer lowMarginDraftsCount = [SELECT COUNT() FROM Quote WHERE Status = 'Draft' AND Margin_Percentage__c < 15.0];
            AggregateResult[] lowMarginAmount = [SELECT SUM(Total_Amount__c) amt FROM Quote WHERE Status = 'Draft' AND Margin_Percentage__c < 15.0];
            Decimal lowMarginAmt = lowMarginAmount.isEmpty() || lowMarginAmount[0].get('amt') == null ? 0.0 : (Decimal)lowMarginAmount[0].get('amt');
            
            result.put('lowMarginCount', lowMarginDraftsCount);
            result.put('lowMarginAmount', lowMarginAmt);

            // Insight 4: High Margin Deals (Margin >= 35%)
            Integer highMarginCount = [SELECT COUNT() FROM Quote WHERE Margin_Percentage__c >= 35.0];
            AggregateResult[] highMarginAmtAgg = [SELECT SUM(Total_Amount__c) amt FROM Quote WHERE Margin_Percentage__c >= 35.0];
            Decimal highMarginAmt = highMarginAmtAgg.isEmpty() || highMarginAmtAgg[0].get('amt') == null ? 0.0 : (Decimal)highMarginAmtAgg[0].get('amt');
            
            result.put('highMarginDealCount', highMarginCount);
            result.put('highMarginDealAmount', highMarginAmt);

            // Insight 5: Won This Month (Won maps to Accepted)
            Integer wonThisMonthCount = [SELECT COUNT() FROM Quote WHERE Status = 'Approved' AND LastModifiedDate = THIS_MONTH];
            AggregateResult[] wonAmtAgg = [SELECT SUM(Total_Amount__c) amt FROM Quote WHERE Status = 'Approved' AND LastModifiedDate = THIS_MONTH];
            Decimal wonAmt = wonAmtAgg.isEmpty() || wonAmtAgg[0].get('amt') == null ? 0.0 : (Decimal)wonAmtAgg[0].get('amt');
            
            result.put('wonThisMonthCount', wonThisMonthCount);
            result.put('wonThisMonthAmount', wonAmt);

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<Quote> getQuotesByStatus(String status) {
        String query = 'SELECT Id, Name, Status, Total_Amount__c, Margin_Percentage__c, LastModifiedDate FROM Quote ';
        
        if (status != null && status != 'All') {
            if (status == 'Pending') {
                query += ' WHERE Status IN (\'Needs Review\', \'In Review\') ';
            } else if (status == 'Won' || status == 'Accepted') {
                query += ' WHERE Status = \'Accepted\' ';
            } else {
                // Draft, Approved, Rejected will map directly as they share the same strings.
                query += ' WHERE Status = :status ';
            }
        }
        
        query += ' ORDER BY LastModifiedDate DESC LIMIT 50';
        
        return Database.query(query);
    }

    @AuraEnabled(cacheable=true)
    public static List<Quote> getAllQuotes() {
        return [
            SELECT Id, QuoteNumber, OpportunityId, Opportunity.Name, Opportunity.AccountId, Opportunity.Account.Name, 
                   Status, CreatedById, CreatedBy.Name, CreatedDate, 
                   Total_Amount__c, Discount, Margin_Percentage__c 
            FROM Quote 
            ORDER BY CreatedDate DESC 
            LIMIT 50
        ];
    }
}
