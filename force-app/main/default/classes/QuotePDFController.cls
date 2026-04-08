public with sharing class QuotePDFController {
    public Quote quoteRecord { get; set; }
    public List<LineItemWrapper> wrappedItems { get; set; }
    public Decimal grandTotal { get; set; }

    public class LineItemWrapper {
        public String itemType { get; set; }
        public String name { get; set; }
        public String phase { get; set; }
        public Date startDate { get; set; }
        public Date endDate { get; set; }
        public Decimal quantity { get; set; }
        public Decimal unitPrice { get; set; }
        public Decimal discount { get; set; }
        public Decimal totalPrice { get; set; }
    }

    public QuotePDFController(ApexPages.StandardController stdController) {
        Id quoteId = stdController.getId();
        wrappedItems = new List<LineItemWrapper>();
        
        if (quoteId != null) {
            quoteRecord = [SELECT Id, QuoteNumber, Account.Name, Opportunity.Name, 
                                  Description, Total_Amount__c, Discount__c, Margin_Percentage__c, Status
                           FROM Quote WHERE Id = :quoteId LIMIT 1];
            grandTotal = quoteRecord.Total_Amount__c;
            
            for (Quote_Item__c item : [SELECT Item_Name__c, Item_Type__c, Quantity__c, UnitPrice__c, Total_Price__c, Discount__c, Phase__c, Start_Date__c, End_Date__c
                         FROM Quote_Item__c WHERE Quote__c = :quoteId ORDER BY Phase__c NULLS LAST, CreatedDate ASC]) {
                LineItemWrapper wrapper = new LineItemWrapper();
                wrapper.itemType = item.Item_Type__c;
                wrapper.name = item.Item_Name__c;
                wrapper.phase = item.Phase__c;
                wrapper.startDate = item.Start_Date__c;
                wrapper.endDate = item.End_Date__c;
                wrapper.quantity = item.Quantity__c;
                wrapper.unitPrice = item.UnitPrice__c;
                wrapper.discount = item.Discount__c != null ? item.Discount__c : 0;
                wrapper.totalPrice = item.Total_Price__c;
                wrappedItems.add(wrapper);
            }
        }
    }
}
