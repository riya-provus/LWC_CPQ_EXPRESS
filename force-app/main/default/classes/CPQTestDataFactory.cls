@isTest
public class CPQTestDataFactory {
    
    public static void createSettings() {
        if ([SELECT COUNT() FROM CPQ_Settings__c] == 0) {
            insert new CPQ_Settings__c(
                Name = 'Default',
                Company_Name__c = 'Test Company',
                PDF_Format__c = 'Standard'
            );
        }
    }

    public static Account createAccount(String name) {
        Account acc = new Account(Name = name, Type = 'Customer', Industry = 'Technology');
        insert acc;
        return acc;
    }

    public static Opportunity createOpportunity(Id accId, String name) {
        Opportunity opp = new Opportunity(
            Name = name,
            AccountId = accId,
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30)
        );
        insert opp;
        return opp;
    }

    public static Quote createQuote(Id oppId, String name) {
        Quote q = new Quote(
            Name = name,
            OpportunityId = oppId,
            Status = 'Draft',
            ExpirationDate = Date.today().addDays(30)
        );
        insert q;
        return q;
    }

    public static CPQ_Product__c createProduct(String name, Decimal price, Decimal cost) {
        CPQ_Product__c p = new CPQ_Product__c(
            Name = name,
            Price__c = price,
            Cost__c = cost,
            Active__c = true
        );
        insert p;
        return p;
    }

    public static CPQ_Addon__c createAddon(String name, Decimal price, Decimal cost) {
        CPQ_Addon__c a = new CPQ_Addon__c(
            Name = name,
            Price__c = price,
            Cost__c = cost,
            Active__c = true
        );
        insert a;
        return a;
    }

    public static Resource_Role__c createRole(String name, Decimal rate) {
        Resource_Role__c r = new Resource_Role__c(
            Name = name,
            Price__c = rate,
            Billing_Unit__c = 'Hourly'
        );
        insert r;
        return r;
    }
}
