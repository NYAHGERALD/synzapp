1. Incident Node

Purpose: Parent container for one complete RCA investigation.

This is the master node. Every other node should belong to one Incident Node.

Node Detail Panel Fields

Incident ID
Text / auto-generated

Incident Title
Text

Incident Category
Dropdown:

Safety
Food Safety
Quality
Equipment
Production
Warehouse
Environmental
Customer Complaint
Regulatory / Audit
Other

Department
Dropdown:

Production
Maintenance
Quality
Safety
Warehouse
Sanitation
Engineering
Shipping / Receiving
Other

Area / Location
Text

Line / Machine / Process
Text

Shift
Dropdown:

1st Shift
2nd Shift
3rd Shift
Weekend
Other

Date of Incident
Date

Time of Incident
Time

Reported By
User selector

Supervisor on Duty
User selector

Severity Level
Dropdown:

Low
Medium
High
Critical

Incident Description
Long text

Immediate Impact
Long text

Product Affected?
Dropdown:

Yes
No
Unknown

Product Name / Code
Text

Lot Number
Text

Quantity Affected
Number / text

Incident Status
Dropdown:

Draft
Open
Containment
Investigation
RCA Review
CAPA Open
Verification
Pending Approval
Closed
Reopened
2. Incident Details Node

Purpose: Capture detailed “what, where, when, who, and impact.”

This can be attached to the Incident Node.

Fields

What Happened?
Long text

Where Did It Happen?
Text

When Did It Happen?
Date/time

Who Was Involved?
People selector / text

Who Discovered It?
User selector

Was Anyone Injured?
Dropdown:

Yes
No
Unknown

Was Product Affected?
Dropdown:

Yes
No
Unknown

Was Equipment Affected?
Dropdown:

Yes
No
Unknown

Was Production Interrupted?
Dropdown:

Yes
No

Downtime Duration
Number / time

Initial Business Impact
Dropdown:

Safety Risk
Food Safety Risk
Quality Defect
Equipment Downtime
Product Loss
Customer Impact
Regulatory Risk
Other

Detailed Description
Long text

3. Containment Node

Purpose: Record immediate actions taken to stop the issue from getting worse.

Fields

Containment Title
Text

Is the Issue Still Active?
Dropdown:

Yes
No
Unknown

Containment Type
Dropdown:

Stop Production
Isolate Equipment
Lockout / Tagout
Product Hold
Quarantine Material
Clean Area
Block Area
Notify Department
Temporary Repair
Other

Was Production Stopped?
Dropdown:

Yes
No
Not Applicable

Time Production Stopped
Time

Was Equipment Isolated?
Dropdown:

Yes
No
Not Applicable

Lockout/Tagout Required?
Dropdown:

Yes
No
Not Applicable

Was Product Placed on Hold?
Dropdown:

Yes
No
Not Applicable

Hold Tag Number
Text

Quantity on Hold
Number / text

Was QA Notified?
Dropdown:

Yes
No
Not Applicable

Was Safety Notified?
Dropdown:

Yes
No
Not Applicable

Was Maintenance Notified?
Dropdown:

Yes
No
Not Applicable

Was Warehouse Notified?
Dropdown:

Yes
No
Not Applicable

Temporary Fix Applied?
Dropdown:

Yes
No

Temporary Fix Description
Long text

Containment Owner
User selector

Containment Status
Dropdown:

Open
In Progress
Completed
Escalated

Containment Completion Time
Date/time

Containment Evidence
Attach Evidence Node / file

4. Evidence Node

Purpose: Attach proof to any node: incident, problem, cause, why, root cause, CAPA, verification, or closure.

This should be a reusable node.

Fields

Evidence Title
Text

Evidence Type
Dropdown:

Photo
Video
Interview
Maintenance Record
PM Record
Cleaning Record
Production Record
Quality Record
Warehouse Scan Record
Machine Data
Sensor Data
SOP / Work Instruction
Training Record
Audit Record
Product Hold Record
Other

Evidence Category
Dropdown:

People
Machine
Method
Material
Environment
Measurement
Management

Evidence Description
Long text

Collected By
User selector

Date Collected
Date

Time Collected
Time

Source of Evidence
Text

File Upload
File attachment

Evidence Link
URL

Evidence Verified?
Dropdown:

Yes
No
Pending Review

Verified By
User selector

Verification Notes
Long text

Evidence Relevance
Dropdown:

Supports Cause
Disproves Cause
Background Information
Needs Review

Linked To Node
Node selector

5. Problem Node

Purpose: Define a specific problem statement inside the RCA.

This is useful when one incident has multiple problems.

Example:
Incident: Oven smoke
Problem Node 1: Flour accumulation under oven
Problem Node 2: Scraper gap excessive
Problem Node 3: Cleaning frequency insufficient

Fields

Problem Statement
Long text

Problem Type
Dropdown:

Safety
Food Safety
Quality
Equipment
Process
Warehouse
Environmental
Other

Problem Location
Text

Problem Start Time
Date/time

Problem Detected By
User selector

Problem Impact
Long text

Known Facts
Long text

Unknown Information
Long text

Problem Status
Dropdown:

Open
Under Investigation
Linked to Cause
Resolved
Eliminated

Attach Evidence
Evidence node selector

6. Fishbone Branch Node

You already create these automatically when clicking the Fishbone button.

Recommended branch nodes:

People
Machine
Method
Material
Environment
Measurement
Management System

I strongly recommend adding Management System because enterprise-level RCAs often fail when this category is missing.

Fields

Branch Name
Dropdown:

People
Machine
Method
Material
Environment
Measurement
Management System

Branch Description
Long text

Branch Owner
User selector

Branch Status
Dropdown:

Not Started
Brainstorming
Needs Evidence
Prioritized
Eliminated
Verified Contributor

Branch Notes
Long text

7. Cause Node

Purpose: A possible cause under a Fishbone branch.

This is one of the most important nodes.

Fields

Cause Statement
Long text

Cause Category
Dropdown:

People
Machine
Method
Material
Environment
Measurement
Management System

Cause Subcategory
Dropdown based on category.

For Machine:

Worn Part
Machine Failure
Sensor Failure
Belt Issue
Scraper Issue
Motor Issue
Guarding Issue
Poor Adjustment
Equipment Design Issue
Other

For Method:

SOP Missing
SOP Not Followed
Cleaning Process Issue
Setup Issue
Changeover Issue
Inspection Gap
Poor Standard Work
Process Not Clear
Other

For Material:

Raw Material Issue
Supplier Variation
Moisture Issue
Packaging Issue
Ingredient Issue
Contamination
Lot Variation
Other

For People:

Training Gap
Communication Gap
Staffing Issue
Operator Error
Supervisor Oversight
Fatigue
Unclear Responsibility
Other

For Environment:

Temperature
Humidity
Dust
Lighting
Airflow
Space Constraint
Sanitation Condition
Other

For Measurement:

Calibration Issue
Sensor Inaccuracy
Scale Issue
Missing Inspection
Incorrect Data
No Standard Limit
Other

For Management System:

PM Program Gap
Poor Scheduling
Lack of Resources
Weak Follow-Up
No Escalation Process
Poor Audit System
No Trend Review
Other

Cause Description
Long text

Supporting Evidence
Evidence node selector

Evidence Strength
Dropdown:

Weak
Medium
Strong

Cause Status
Dropdown:

Possible
Unlikely
Needs Evidence
High Priority
Eliminated
Verified Contributor

Suspicious?
Checkbox

Move to 5 Whys?
Dropdown:

Yes
No
Pending Review

Reason for Decision
Long text

8. Cause Prioritization Node

Purpose: Score and decide which cause should move into Extended 5 Whys.

Fields

Selected Cause
Cause node selector

Fishbone Branch
Dropdown:

People
Machine
Method
Material
Environment
Measurement
Management System

Why Is This Cause Likely?
Long text

Supporting Evidence
Evidence node selector

Evidence Strength Score
Dropdown:

1 Very Weak
2 Weak
3 Moderate
4 Strong
5 Very Strong

Risk Score
Dropdown:

1 Low
2 Minor
3 Moderate
4 High
5 Critical

Frequency Score
Dropdown:

1 Rare
2 Occasional
3 Repeated
4 Frequent
5 Chronic

Severity Score
Dropdown:

1 Low
2 Minor
3 Moderate
4 High
5 Critical

History of Similar Issues?
Dropdown:

Yes
No
Unknown

Similar Incident Reference
Incident selector / text

Expert Review Needed?
Dropdown:

Yes
No

Reviewed By
User selector

Priority Level
Dropdown:

Low
Medium
High
Critical

Move to Extended 5 Whys?
Dropdown:

Yes
No

Reason for Decision
Long text

9. Why Node

Purpose: Represent each “Why?” question in the 5 Why chain.

A Why Node should connect to an Answer Node.

Fields

Why Number
Dropdown:

Why 1
Why 2
Why 3
Why 4
Why 5
Additional Why

Why Question
Long text

Related Cause
Cause node selector

Related Previous Answer
Answer node selector

Question Type
Dropdown:

Physical Cause
Human Cause
Process Cause
Equipment Cause
Management System Cause
Organizational Cause

Requires Evidence?
Dropdown:

Yes
No

Why Status
Dropdown:

Draft
Answer Needed
Answered
Needs Evidence
Verified
Rejected
10. Answer Node

Purpose: Capture the answer to each Why Node.

Fields

Answer Statement
Long text

Related Why Question
Why node selector

Supporting Evidence
Evidence node selector

Evidence Strength
Dropdown:

Weak
Medium
Strong

Is This Answer Verified?
Dropdown:

Yes
No
Pending

Verified By
User selector

Answer Type
Dropdown:

Direct Cause
Contributing Cause
Assumption
Verified Fact
Eliminated Cause

Does This Answer Lead to Another Why?
Dropdown:

Yes
No

Next Why Node
Why node selector

Answer Notes
Long text

11. Root Cause Node

Purpose: Capture the proposed or final root cause.

Fields

Root Cause Statement
Long text

Root Cause Type
Dropdown:

Physical
Human
Process
Equipment
Management System
Organizational
Supplier
Environmental
Measurement

Related 5 Why Chain
Node selector

Related Cause Node
Cause node selector

Evidence Supporting Root Cause
Evidence node selector

Evidence Against Root Cause
Evidence node selector

Root Cause Description
Long text

Would Fixing This Prevent Recurrence?
Dropdown:

Yes
No
Partially
Unknown

Is This a System Failure?
Dropdown:

Yes
No
Partially

Is This Blaming an Individual?
Dropdown:

Yes
No

Other Causes Ruled Out?
Dropdown:

Yes
No
In Progress

Ruled Out Cause List
Long text

Validation Status
Dropdown:

Proposed
Approved
Rejected
Needs More Investigation

Validated By
User selector

Validation Date
Date

Validation Comments
Long text

12. CAPA Parent Node

Purpose: Container for all corrective, preventive, risk, effectiveness, lessons learned, and closure nodes.

This is useful because many actions can belong to one RCA.

Fields

CAPA ID
Auto-generated

Related Root Cause
Root cause node selector

CAPA Summary
Long text

CAPA Owner
User selector

CAPA Status
Dropdown:

Draft
Open
In Progress
Pending Verification
Completed
Overdue
Closed

CAPA Due Date
Date

CAPA Priority
Dropdown:

Low
Medium
High
Critical
13. Corrective Action Node

Purpose: Fix the confirmed root cause.

Example: “Add scraper gap verification to PM checklist.”

Fields

Corrective Action Title
Text

Related Root Cause
Root cause node selector

Action Description
Long text

Action Owner
User selector

Department Responsible
Dropdown:

Production
Maintenance
Quality
Safety
Warehouse
Sanitation
Engineering
Other

Priority
Dropdown:

Low
Medium
High
Critical

Due Date
Date

Required Resources
Long text

Estimated Cost
Number

Approval Required?
Dropdown:

Yes
No

Approved By
User selector

Action Status
Dropdown:

Not Started
In Progress
Completed
Overdue
Cancelled

Completion Date
Date

Completion Evidence
Evidence node selector / file upload

Completion Notes
Long text

14. Preventive Action Node

Purpose: Prevent the issue from happening again elsewhere.

Example: “Inspect all similar ovens across all lines.”

Fields

Preventive Action Title
Text

Related Root Cause
Root cause node selector

Preventive Action Scope
Dropdown:

Same Line
Same Department
Entire Plant
Multiple Plants
Supplier
Warehouse Network
Enterprise-Wide

Action Description
Long text

Area Affected
Text

Action Owner
User selector

Department Responsible
Dropdown:

Production
Maintenance
Quality
Safety
Warehouse
Sanitation
Engineering
Other

Priority
Dropdown:

Low
Medium
High
Critical

Due Date
Date

Training Required?
Dropdown:

Yes
No

SOP Update Required?
Dropdown:

Yes
No

PM Update Required?
Dropdown:

Yes
No

HACCP / Food Safety Plan Update Required?
Dropdown:

Yes
No
Not Applicable

Action Status
Dropdown:

Not Started
In Progress
Completed
Overdue
Cancelled

Completion Evidence
Evidence node selector / file upload

15. Risk Assessment Node

Purpose: Measure risk before and after CAPA.

Fields

Risk Assessment ID
Auto-generated

Assessment Type
Dropdown:

Before CAPA
After CAPA
Residual Risk Review

Related Incident
Incident node selector

Related Root Cause
Root cause node selector

Related CAPA
CAPA node selector

Severity Score
Dropdown:

1 Low
2 Minor
3 Moderate
4 High
5 Critical

Occurrence Score
Dropdown:

1 Rare
2 Unlikely
3 Possible
4 Likely
5 Frequent

Detection Score
Dropdown:

1 Easily Detected
2 Likely Detected
3 Moderate Detection
4 Difficult to Detect
5 Not Detectable

RPN Score
Auto-calculate: Severity × Occurrence × Detection

Risk Level
Auto-calculate / dropdown:

Low
Medium
High
Critical

Risk Justification
Long text

Residual Risk Acceptable?
Dropdown:

Yes
No
Requires Management Approval

Risk Approved By
User selector

Risk Approval Comments
Long text

16. Effectiveness Verification Node

Purpose: Confirm the CAPA worked.

Fields

Verification ID
Auto-generated

Related CAPA
CAPA node selector

Verification Method
Dropdown:

Audit
Inspection
Trend Review
Observation
Test Run
No Repeat Incident
KPI Review
Product Review
PM Audit
Warehouse Audit

Verification Owner
User selector

Verification Due Date
Date

Verification Interval
Dropdown:

30 Days
60 Days
90 Days
180 Days
Custom

Success Criteria
Long text

Verification Result
Dropdown:

Pass
Fail
Needs More Time

Evidence Upload
Evidence node selector / file upload

Verification Notes
Long text

If Failed, Reopen RCA?
Dropdown:

Yes
No

Reopened Reason
Long text

17. Lessons Learned Node

Purpose: Capture organizational learning.

Fields

Lesson Learned Summary
Long text

What Went Wrong?
Long text

What Worked Well?
Long text

What Should Change?
Long text

Can This Happen Elsewhere?
Dropdown:

Yes
No
Unknown

Other Lines / Areas Affected
Text

SOP Update Needed?
Dropdown:

Yes
No

PM Update Needed?
Dropdown:

Yes
No

Training Update Needed?
Dropdown:

Yes
No

HACCP / Food Safety Plan Update Needed?
Dropdown:

Yes
No
Not Applicable

Warehouse Process Update Needed?
Dropdown:

Yes
No
Not Applicable

Share With Other Departments?
Dropdown:

Yes
No

Knowledge Base Article Required?
Dropdown:

Yes
No

Lesson Owner
User selector

Lesson Approval Status
Dropdown:

Draft
Pending Review
Approved
Rejected
18. Approval & Closure Node

Purpose: Final management review and official RCA closure.

Fields

Closure Review ID
Auto-generated

Investigation Summary
Long text

Final Root Cause
Root cause node selector

Final CAPA Summary
Long text

Final Risk Level
Dropdown:

Low
Medium
High
Critical

Effectiveness Verified?
Dropdown:

Yes
No

All Actions Completed?
Dropdown:

Yes
No

All Evidence Attached?
Dropdown:

Yes
No

Lessons Learned Completed?
Dropdown:

Yes
No

Closure Recommendation
Dropdown:

Close
Keep Open
Reopen Investigation

Production Manager Approval
Dropdown:

Not Required
Pending
Approved
Rejected

Maintenance Manager Approval
Dropdown:

Not Required
Pending
Approved
Rejected

Quality Manager Approval
Dropdown:

Not Required
Pending
Approved
Rejected

Safety Manager Approval
Dropdown:

Not Required
Pending
Approved
Rejected

Warehouse Manager Approval
Dropdown:

Not Required
Pending
Approved
Rejected

Plant Manager Approval
Dropdown:

Not Required
Pending
Approved
Rejected

Final Approver
User selector

Closure Date
Date

Closure Comments
Long text

Nodes I Recommend You Add

Add these:

Cause Node
For Fishbone possible causes.
Cause Prioritization Node
To decide which causes move to 5 Whys.
Corrective Action Node
Separate from CAPA parent.
Preventive Action Node
Separate from corrective action.
Management System Branch
Add this to Fishbone.
Approval & Closure Node
Already shown under CAPA menu; keep it.
Nodes You Already Have That Make Sense

Keep:

Incident
Incident Details
Containment
Evidence
Problem
Why
Answer
Root Cause
CAPA
Corrective
Preventive
Risk Assessment
Effectiveness
Lessons Learned
Approval & Closure
Best Visual RCA Flow
Incident
  ↓
Incident Details
  ↓
Containment
  ↓
Evidence
  ↓
Problem
  ↓
Fishbone Branches
  ↓
Cause Nodes
  ↓
Cause Prioritization
  ↓
Why → Answer → Why → Answer
  ↓
Root Cause
  ↓
CAPA
  ↓
Corrective Action
  ↓
Preventive Action
  ↓
Risk Assessment
  ↓
Effectiveness Verification
  ↓
Lessons Learned
  ↓
Approval & Closure