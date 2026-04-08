public with sharing class QuoteExplorerController {
    
    @AuraEnabled(cacheable=true)
    public static QuoteSummary getQuoteSummary(Id quoteId) {
        Quote q = [SELECT Id, QuoteNumber, Status, Description, 
                          Opportunity.Name, Account.Name, 
                          Subtotal, Total_Amount__c, GrandTotal, 
                          Discount__c, Margin_Percentage__c,
                          CreatedDate, ExpirationDate
                   FROM Quote 
                   WHERE Id = :quoteId 
                   LIMIT 1];
        
        QuoteSummary summary = new QuoteSummary();
        summary.quoteId = q.Id;
        summary.quoteNumber = q.QuoteNumber;
        summary.status = q.Status;
        summary.description = q.Description;
        summary.opportunityName = q.Opportunity != null ? q.Opportunity.Name : 'N/A';
        summary.accountName = q.Account != null ? q.Account.Name : 'N/A';
        summary.totalAmount = q.Total_Amount__c;
        summary.subtotal = q.Subtotal;
        summary.grandTotal = q.GrandTotal;
        summary.discount = q.Discount__c;
        summary.margin = q.Margin_Percentage__c;
        summary.createdDate = q.CreatedDate;
        summary.expirationDate = q.ExpirationDate;
        
        return summary;
    }

    @AuraEnabled(cacheable=true)
    public static List<BreakdownItem> getQuoteBreakdown(Id quoteId) {
        List<BreakdownItem> breakdown = new List<BreakdownItem>();
        
        // Aggregate by Product Family (Item Type)
        AggregateResult[] arList = [SELECT Item_Type__c family, SUM(Total_Price__c) total 
                                   FROM Quote_Item__c 
                                   WHERE Quote__c = :quoteId 
                                   GROUP BY Item_Type__c];
        
        for (AggregateResult ar : arList) {
            BreakdownItem item = new BreakdownItem();
            item.label = (String)ar.get('family');
            if (String.isBlank(item.label)) item.label = 'Other';
            item.value = (Decimal)ar.get('total');
            breakdown.add(item);
        }
        
        return breakdown;
    }

    @AuraEnabled(cacheable=true)
    public static List<ApprovalStep> getApprovalHistory(Id quoteId) {
        List<ApprovalStep> history = new List<ApprovalStep>();
        
        List<ProcessInstance> instances = [SELECT Id, (SELECT Id, StepStatus, Comments, CreatedDate, Actor.Name 
                                                       FROM StepsAndWorkitems 
                                                       ORDER BY CreatedDate DESC)
                                          FROM ProcessInstance 
                                          WHERE TargetObjectId = :quoteId 
                                          ORDER BY CreatedDate DESC];
        
        for (ProcessInstance pi : instances) {
            for (ProcessInstanceHistory step : pi.StepsAndWorkitems) {
                ApprovalStep s = new ApprovalStep();
                s.status = step.StepStatus;
                s.comments = step.Comments;
                s.actorName = step.Actor.Name;
                s.createdDate = step.CreatedDate;
                history.add(s);
            }
        }
        
        return history;
    }

    @AuraEnabled(cacheable=true)
    public static List<LineItemWrapper> getQuoteLineItems(Id quoteId) {
        List<LineItemWrapper> wrappers = new List<LineItemWrapper>();
        
        List<Quote_Item__c> items = [SELECT Id, Item_Name__c, Item_Type__c, 
                                            Phase__c, Start_Date__c, End_Date__c, 
                                            Quantity__c, UnitPrice__c, 
                                            Discount__c, Total_Price__c,
                                            CPQ_Product__r.Cost__c, CPQ_Addon__r.Cost__c 
                                     FROM Quote_Item__c 
                                     WHERE Quote__c = :quoteId 
                                     ORDER BY Phase__c NULLS LAST, CreatedDate ASC];
        
        for (Quote_Item__c qli : items) {
            wrappers.add(new LineItemWrapper(qli));
        }
        
        return wrappers;
    }

    @AuraEnabled(cacheable=true)
    public static SelectionData getSelectionData() {
        SelectionData data = new SelectionData();
        data.products = [SELECT Id, Name, Description__c, Price__c, Cost__c FROM CPQ_Product__c WHERE Active__c = true];
        data.addons = [SELECT Id, Name, Description__c, Price__c, Cost__c FROM CPQ_Addon__c WHERE Active__c = true];
        data.resourceRoles = [SELECT Id, Name, Description__c, Price__c, Billing_Unit__c FROM Resource_Role__c];
        return data;
    }

    @AuraEnabled
    public static void saveQuoteLineItems(List<Quote_Item__c> items) {
        try {
            upsert items;
            
            if(items.size() > 0 && items[0].Quote__c != null) {
                syncQuoteRollups(items[0].Quote__c);
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error saving line items: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String submitForApproval(Id quoteId) {
        try {
            // First, set status to 'Needs Review'
            Quote qRec = new Quote(Id = quoteId, Status = 'Needs Review');
            update qRec;

            // Try native Salesforce approval process
            try {
                Approval.ProcessSubmitRequest req = new Approval.ProcessSubmitRequest();
                req.setObjectId(quoteId);
                req.setSubmitterId(UserInfo.getUserId());
                req.setComments('Submitted for approval via CPQ Express.');
                Approval.ProcessResult result = Approval.process(req);
                if (result.isSuccess()) {
                    return 'SUBMITTED';
                } else {
                    // Approval process exists but submission failed for another reason
                    List<Database.Error> errors = result.getErrors();
                    String errMsg = errors != null && !errors.isEmpty() ? errors[0].getMessage() : 'Unknown error';
                    throw new AuraHandledException('Approval submission failed: ' + errMsg);
                }
            } catch (AuraHandledException e) {
                throw e;
            } catch (Exception approvalEx) {
                // No approval process configured — status already set to Needs Review above
                // Update to 'In Review' as a fallback so the record reflects pending state
                Quote fallbackRec = new Quote(Id = quoteId, Status = 'In Review');
                update fallbackRec;
                return 'IN_REVIEW';
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Error submitting for approval: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void updateQuoteStatus(Id quoteId, String newStatus) {
        try {
            update new Quote(Id = quoteId, Status = newStatus);
        } catch (Exception e) {
            throw new AuraHandledException('Error updating quote status: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteQuoteLineItem(Id itemId) {
        try {
            Quote_Item__c item = [SELECT Id, Quote__c FROM Quote_Item__c WHERE Id = :itemId LIMIT 1];
            Id quoteId = item.Quote__c;
            delete item;
            // Re-sync rollups after deletion so totals update
            syncQuoteRollups(quoteId);
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting line item: ' + e.getMessage());
        }
    }

    private static void syncQuoteRollups(Id quoteId) {
        List<Quote_Item__c> allItems = [SELECT Quantity__c, UnitPrice__c, Total_Price__c, 
                                               CPQ_Product__r.Cost__c, CPQ_Addon__r.Cost__c 
                                        FROM Quote_Item__c 
                                        WHERE Quote__c = :quoteId];
        
        Decimal subtotal = 0;
        Decimal totalAmount = 0;
        Decimal totalCost = 0;
        
        for(Quote_Item__c item : allItems) {
            Decimal q = item.Quantity__c != null ? item.Quantity__c : 0;
            Decimal price = item.UnitPrice__c != null ? item.UnitPrice__c : 0;
            Decimal total = item.Total_Price__c != null ? item.Total_Price__c : 0;
            
            Decimal cost = 0;
            if(item.CPQ_Product__r != null && item.CPQ_Product__r.Cost__c != null) {
                cost = item.CPQ_Product__r.Cost__c;
            } else if(item.CPQ_Addon__r != null && item.CPQ_Addon__r.Cost__c != null) {
                cost = item.CPQ_Addon__r.Cost__c;
            }
            
            subtotal += (q * price);
            totalAmount += total;
            totalCost += (q * cost);
        }
        
        Decimal marginAmt = totalAmount - totalCost;
        Decimal marginPct = totalAmount > 0 ? ((marginAmt / totalAmount) * 100).setScale(2, System.RoundingMode.HALF_UP) : 0;
        if (marginPct > 999.99) marginPct = 999.99;
        if (marginPct < -999.99) marginPct = -999.99;
        
        Decimal discountAmt = totalAmount - subtotal;
        Decimal discountPct = subtotal > 0 ? ((discountAmt / subtotal) * 100).setScale(2, System.RoundingMode.HALF_UP) : 0;
        if (discountPct > 999.99) discountPct = 999.99;
        if (discountPct < -999.99) discountPct = -999.99;
        
        Quote qRec = new Quote(Id = quoteId);
        // We do NOT write to standard Subtotal because it is locked by Salesforce as a native rollup field
        qRec.Total_Amount__c = totalAmount;
        qRec.Discount__c = discountPct; 
        qRec.Margin_Percentage__c = marginPct;
        
        update qRec;
    }

    public class QuoteSummary {
        @AuraEnabled public Id quoteId;
        @AuraEnabled public String quoteNumber;
        @AuraEnabled public String status;
        @AuraEnabled public String description;
        @AuraEnabled public String opportunityName;
        @AuraEnabled public String accountName;
        @AuraEnabled public Decimal totalAmount;
        @AuraEnabled public Decimal subtotal;
        @AuraEnabled public Decimal grandTotal;
        @AuraEnabled public Decimal discount;
        @AuraEnabled public Decimal margin;
        @AuraEnabled public DateTime createdDate;
        @AuraEnabled public Date expirationDate;
    }

    public class BreakdownItem {
        @AuraEnabled public String label;
        @AuraEnabled public Decimal value;
    }

    public class ApprovalStep {
        @AuraEnabled public String status;
        @AuraEnabled public String comments;
        @AuraEnabled public String actorName;
        @AuraEnabled public DateTime createdDate;
    }

    public class SelectionData {
        @AuraEnabled public List<CPQ_Product__c> products;
        @AuraEnabled public List<CPQ_Addon__c> addons;
        @AuraEnabled public List<Resource_Role__c> resourceRoles;
    }

    public class LineItemWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String family;
        @AuraEnabled public String phase;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public Decimal quantity;
        @AuraEnabled public Decimal baseRate;
        @AuraEnabled public Decimal unitPrice;
        @AuraEnabled public Decimal unitCost;
        @AuraEnabled public Decimal discount;
        @AuraEnabled public Decimal totalValue;
        
        public LineItemWrapper(Quote_Item__c qli) {
            this.id = qli.Id;
            this.name = qli.Item_Name__c;
            this.family = qli.Item_Type__c;
            this.phase = qli.Phase__c;
            this.startDate = qli.Start_Date__c;
            this.endDate = qli.End_Date__c;
            this.quantity = qli.Quantity__c;
            this.baseRate = qli.UnitPrice__c;
            this.unitPrice = qli.UnitPrice__c;
            
            Decimal cost = 0;
            if (qli.CPQ_Product__c != null) cost = qli.CPQ_Product__r.Cost__c;
            if (qli.CPQ_Addon__c != null) cost = qli.CPQ_Addon__r.Cost__c;
            this.unitCost = cost != null ? cost : 0;
            
            this.discount = qli.Discount__c;
            this.totalValue = qli.Total_Price__c;
        }
    }
}
