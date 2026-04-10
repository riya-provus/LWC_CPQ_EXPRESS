public with sharing class QuotesListController {
    
    @AuraEnabled(cacheable=true)
    public static List<Quote> getAllQuotes() {
        try {
            // Identify the current user's role
            User curr = [SELECT CPQ_Role__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
            String role = curr.CPQ_Role__c != null ? curr.CPQ_Role__c : 'User';

            String query = 'SELECT Id, QuoteNumber, AccountId, OpportunityId, Opportunity.Name, ' +
                           'Opportunity.AccountId, Opportunity.Account.Name, ' +
                           'Status, CreatedById, CreatedBy.Name, CreatedDate, ' +
                           'Total_Amount__c, Discount__c, Margin_Percentage__c, ' +
                           'Description, ExpirationDate ' +
                           'FROM Quote ';
            
            // We used to strictly filter for Managers here, but now we allow them to see all quotes
            // and handle the default 'In Review' filter on the client-side LWC.
            /*
            if (role == 'Manager') {
                query += 'WHERE Status = \'In Review\' ';
            }
            */

            query += 'ORDER BY CreatedDate DESC LIMIT 200';
            return Database.query(query);
        } catch (Exception e) {
            throw new AuraHandledException('Error fetching quotes: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        return [SELECT Id, Name FROM Account ORDER BY Name LIMIT 100];
    }

    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpportunities() {
        return [SELECT Id, Name, AccountId, Account.Name FROM Opportunity WHERE IsClosed = false ORDER BY Name LIMIT 100];
    }

    @AuraEnabled
    public static String createQuote(String opportunityId, String accountId, String description,
                                     String startDate, String endDate, String timePeriod) {
        try {
            Quote q = new Quote();
            q.Name = 'Quote-' + System.now().format('yyyyMMdd-HHmmss');

            if (String.isNotBlank(opportunityId)) {
                // Use the explicitly selected Opportunity
                q.OpportunityId = opportunityId;
            } else if (String.isNotBlank(accountId)) {
                // No Opportunity selected — look for an existing open one for this Account
                List<Opportunity> existingOpps = [
                    SELECT Id FROM Opportunity 
                    WHERE AccountId = :accountId AND IsClosed = false 
                    ORDER BY CreatedDate DESC LIMIT 1
                ];
                if (!existingOpps.isEmpty()) {
                    q.OpportunityId = existingOpps[0].Id;
                } else {
                    // Auto-create a placeholder Opportunity so the Account link is preserved
                    Account acc = [SELECT Name FROM Account WHERE Id = :accountId LIMIT 1];
                    Opportunity autoOpp = new Opportunity();
                    autoOpp.Name        = acc.Name + ' - Auto Opportunity';
                    autoOpp.AccountId   = accountId;
                    autoOpp.StageName   = 'Prospecting';
                    autoOpp.CloseDate   = Date.today().addDays(30);
                    insert autoOpp;
                    q.OpportunityId = autoOpp.Id;
                }
            }

            if (String.isNotBlank(description)) {
                q.Description = description;
            }
            if (String.isNotBlank(endDate)) {
                q.ExpirationDate = Date.valueOf(endDate);
            }
            insert q;
            return q.Id;
        } catch (Exception e) {
            throw new AuraHandledException('Error creating quote: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteQuote(Id quoteId) {
        try {
            delete [SELECT Id FROM Quote WHERE Id = :quoteId];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void cloneQuote(Id quoteId) {
        try {
            Quote original = [
                SELECT Name, OpportunityId, Description, 
                       ContactId, ExpirationDate, Status, Discount__c,
                       Total_Amount__c, Margin_Percentage__c
                FROM Quote 
                WHERE Id = :quoteId 
                LIMIT 1
            ];
            
            Quote cloned = original.clone(false, true, false, false);
            cloned.Name = original.Name + ' (Clone)';
            cloned.Status = 'Draft'; // Reset status for the clone
            insert cloned;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}
