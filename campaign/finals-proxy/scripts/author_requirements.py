"""Independent requirement authoring. Written before reading application source.

The test compiler consumes only the emitted requirements.yaml, not this module.
"""
from pathlib import Path
import json
import yaml

ROOT = Path(__file__).resolve().parents[1]
Q = lambda s: json.dumps(s, ensure_ascii=False)
PAGE = 'the current page'
def scope(role, name): return f'the {role} named {Q(name)}'
def reg(name): return scope('region', name)
def dlg(name): return scope('dialog', name)
GRID = scope('grid', 'Worksheet grid')

class Requirement:
    def __init__(self, task, ident, name, original, summary, seed, difficulty='medium', deps=()):
        self.task, self.ident, self.name = task, ident, name
        self.steps = [{'keyword':'GIVEN', 'content':'The user opens the application home entry in a fresh browser context, signed out.'}, {'keyword':'GIVEN','content':seed}]
        self.sentences=[]
        self.node={'id':ident,'name':name,'type':'ATOMIC','change_type':'CHANGE' if original else 'ADD'}
        if original:self.node['original_requirement_id']=original
        self.node['dependencies']=list(dict.fromkeys(([original] if original else [])+list(deps)))
        self.summary=summary
        DIFFICULTIES[task][ident]=difficulty
        TASKS[task].append(self)
    def add(self, keyword, text): self.steps.append({'keyword':keyword,'content':text}); return self
    def declare(self, text):
        if text not in self.sentences:self.sentences.append(text)
    def loc(self, role, name, where=PAGE):
        if where != PAGE:
            self.declare(f'A visible {where[4:]} contains the controls and content within it in the scenario.')
        self.declare(f'{where[0].upper()+where[1:]} exposes {Q(name)} as a {role}.')
    def nav(self, name, where=PAGE):
        if where!=PAGE:self.loc('region',json.loads(where.split('named ',1)[1]))
        self.declare(f'{where[0].upper()+where[1:]} contains one link or button named {Q(name)} when this action is available.')
        return self.add('WHEN',f'The user activates {Q(name)} in {where}.')
    def click(self, name, where=PAGE, role='button'):
        self.loc(role,name,where)
        return self.add('WHEN',f'The user clicks the {role} named {Q(name)} in {where}.')
    def fill(self,name,value,where=PAGE):
        if where!=PAGE:self.declare(f'A visible {where[4:]} contains the controls and content within it in the scenario.')
        self.declare(f'{where[0].upper()+where[1:]} contains one input labelled {Q(name)}.')
        return self.add('WHEN',f'The user enters {Q(value)} in the {Q(name)} field in {where}.')
    def press(self,name,key,where=PAGE):
        self.declare(f'{where[0].upper()+where[1:]} contains one input labelled {Q(name)}.')
        return self.add('WHEN',f'The user presses {Q(key)} in the {Q(name)} field in {where}.')
    def choose(self,name,value,where=PAGE):
        self.loc('combobox',name,where)
        self.declare(f'The combobox labelled {Q(name)} in {where} provides the option {Q(value)}.')
        return self.add('WHEN',f'The user selects {Q(value)} in the {Q(name)} combobox in {where}.')
    def selected(self,name,value,where=PAGE):
        self.loc('combobox',name,where)
        return self.add('THEN',f'The {Q(name)} combobox in {where} has selected option {Q(value)}.')
    def check(self,name,value=True,where=PAGE):
        self.loc('checkbox',name,where)
        return self.add('WHEN',f'The user {"checks" if value else "unchecks"} {Q(name)} in {where}.')
    def see(self,role,name,where=PAGE):
        self.loc(role,name,where)
        return self.add('THEN',f'The {role} named {Q(name)} is visible exactly once in {where}.')
    def absent(self,role,name,where=PAGE):
        self.loc(role,name,where)
        return self.add('THEN',f'The {role} named {Q(name)} is absent in {where}.')
    def text(self,value,where=PAGE):
        if where!=PAGE:self.declare(f'A visible {where[4:]} contains the controls and content within it in the scenario.')
        self.declare(f'{where[0].upper()+where[1:]} contains the exact visible text {Q(value)} once when specified.')
        return self.add('THEN',f'The exact text {Q(value)} is visible exactly once in {where}.')
    def value(self,name,value,where=PAGE):
        self.declare(f'{where[0].upper()+where[1:]} contains one input labelled {Q(name)}.')
        return self.add('THEN',f'The {Q(name)} field in {where} displays {Q(value)}.')
    def content(self,role,name,value,where=PAGE):
        self.loc(role,name,where)
        return self.add('THEN',f'The {role} named {Q(name)} in {where} has exact text {Q(value)}.')
    def state(self,role,name,attr,value,where=PAGE):
        self.loc(role,name,where)
        self.declare(f'The {role} named {Q(name)} exposes its {attr} state in {where}.')
        return self.add('THEN',f'The {role} named {Q(name)} in {where} has {attr} state {Q(value)}.')
    def order(self,name,values,where=PAGE):
        self.loc('list',name,where)
        self.declare(f'The list named {Q(name)} in {where} contains listitems with the exact stated visible text, in reading order.')
        return self.add('THEN',f'The {Q(name)} list in {where} contains exactly these entries in order: {json.dumps(values)}.')
    def reload(self):return self.add('WHEN','The user reloads the current page.')
    def home(self):return self.add('WHEN','The user returns to the application home entry.')
    def context(self,role,name,where=PAGE):
        self.loc(role,name,where)
        return self.add('WHEN',f'The user right-clicks the {role} named {Q(name)} in {where}.')
    def key(self,role,name,key,where=PAGE):
        self.loc(role,name,where)
        return self.add('WHEN',f'The user presses {Q(key)} on the {role} named {Q(name)} in {where}.')
    def drag(self,a,b):
        self.loc('gridcell',a,GRID);self.loc('gridcell',b,GRID)
        return self.add('WHEN',f'The user drags from gridcell {Q(a)} to gridcell {Q(b)} in {GRID}.')
    def cell(self,addr,value):return self.content('gridcell',addr,value,GRID)
    def edit(self,addr,value):return self.click(addr,GRID,'gridcell').fill('Formula bar',value).press('Formula bar','Enter')
    def login(self,user):
        self.add('GIVEN',f'The original verified account {Q(user)} has email {Q(user+"@example.test")} and password "Valid-password-123!". Its credentials are never changed by these scenarios.')
        return self.nav('Sign in').fill('Username or email',user).fill('Password','Valid-password-123!').click('Sign in').see('button','Account menu')
    def logout(self):return self.click('Account menu').nav('Sign out').see('dialog','Sign out').click('Confirm sign out',dlg('Sign out')).see('link','Sign in')
    def repo(self):
        n='evolution-'+self.ident
        return self.fill('Search',n).press('Search','Enter').nav(n).see('heading','repo-admin/'+n)
    def issue(self,title):return self.nav('Issues').nav(title).see('heading',title)
    def pr(self,title):return self.nav('Pull requests').nav(title).see('heading',title)
    def emit(self):
        self.node['description']=self.summary+'\n\n'+' '.join(self.sentences)
        self.node['scenarios']=[{'name':self.name,'steps':self.steps}]
        return self.node

TASKS={'github':[],'sheet':[]};DIFFICULTIES={'github':{},'sheet':{}}
def github(ident,name,original,summary,seed,user=None,difficulty='medium',deps=()):
    prefix=f'The public repository "evolution-{ident}" is owned by repo-admin. The original account repo-admin has Admin permission; issue-editor, issue-commenter, file-contributor and pr-contributor have Write permission; issue-viewer and pr-viewer have Read permission; pr-author may manage its own PRs and pr-reviewer may review non-authored PRs. main is the default branch. All records in this scenario belong only to this repository. '
    r=Requirement('github',ident,name,original,summary,prefix+seed,difficulty,deps)
    if user:r.login(user)
    return r.repo()

def sheet(ident,name,original,summary,seed,difficulty='medium',deps=()):
    title=name.split(' ')[0]+' '+ident
    prefix=f'The public workbook {Q(title)} exists independently of every other scenario. Unless stated otherwise, it has only Sheet1, active with A1 selected, at least 100 rows and 26 columns, and all unspecified cells blank; there are no filters, validation rules, notes or named ranges. '
    r=Requirement('sheet',ident,name,original,summary,prefix+seed,difficulty,deps)
    r.nav(title).see('grid','Worksheet grid')
    return r

# GitHub CHANGE: ten observable extensions to actual original requirements.
r=github('EV-1.1','Filter issues with combined qualifiers','REQ-5-1-1','Extend Search issues with conjunctive is:open, is:closed, label:<name> and author:<username> qualifiers; unqualified text still matches titles. Qualifiers override the selected status tab. Issue titles lists only matching titles, newest first.',
 'Issues are "Bug EV-1.1" (Closed, label bug, author issue-editor), "Open EV-1.1" (Open, bug, issue-editor), and "Other EV-1.1" (Closed, docs, issue-commenter).')
r.nav('Issues').fill('Search issues','is:closed label:bug author:issue-editor').order('Issue titles',['Bug EV-1.1'],reg('Issues')).absent('link','Open EV-1.1',reg('Issues')).reload().order('Issue titles',['Bug EV-1.1'],reg('Issues'))
r=github('EV-1.2','Sort the filtered issue list','REQ-5-1-1','Add Issue sort with Newest and Oldest options to the Issues region. Sorting operates on the filtered set and persists in the current page after reload.',
 'Open issues "First EV-1.2", "Second EV-1.2", "Third EV-1.2" were created on 2030-01-01, 2030-01-02 and 2030-01-03 respectively, with no other issues.',difficulty='easy')
r.nav('Issues').choose('Issue sort','Oldest',reg('Issues')).order('Issue titles',['First EV-1.2','Second EV-1.2','Third EV-1.2'],reg('Issues')).reload().selected('Issue sort','Oldest',reg('Issues')).choose('Issue sort','Newest',reg('Issues')).order('Issue titles',['Third EV-1.2','Second EV-1.2','First EV-1.2'],reg('Issues'))
r=github('EV-1.3','Filter draft pull requests by author','REQ-6-2-1','Extend the Pull requests list with Search pull requests supporting conjunctive is:draft, is:open and author:<username>. Draft is distinct from ready Open. The Pull request titles list reflects the results.',
 'PRs are "Draft EV-1.3" (Draft, pr-author), "Ready EV-1.3" (Open, pr-author), and "Other EV-1.3" (Draft, pr-contributor); all compare feature to main.')
r.nav('Pull requests').fill('Search pull requests','is:draft author:pr-author').order('Pull request titles',['Draft EV-1.3'],reg('Pull requests')).reload().order('Pull request titles',['Draft EV-1.3'],reg('Pull requests'))
r=github('EV-1.4','Close an issue as not planned','REQ-5-4','Add Close reason with Completed (default) and Not planned. Close issue stores both Closed and the selected reason; Reopen issue clears the reason. Existing immediate close behavior and operation permissions remain.',
 '"Declined EV-1.4" is Open, with description "Keep this description." and no closure reason.','repo-admin')
r.issue('Declined EV-1.4').choose('Close reason','Not planned',reg('Issue')).click('Close issue',reg('Issue')).text('Closed as not planned',reg('Issue')).reload().text('Closed as not planned',reg('Issue')).text('Keep this description.',reg('Issue')).click('Reopen issue',reg('Issue')).text('Open',reg('Issue')).absent('status','Closed as not planned',reg('Issue'))
r=github('EV-1.5','Preview a Markdown issue comment','REQ-5-2-3','Extend the comment editor with Preview and Write buttons. Preview renders Markdown emphasis without publishing or changing the draft. Returning to Write retains the draft; Comment publishes once.',
 '"Preview EV-1.5" is Open and has no comments.','issue-commenter')
r.issue('Preview EV-1.5').fill('Comment','**Reviewed** carefully.').click('Preview',reg('Issue')).text('Reviewed',reg('Comment preview')).click('Write',reg('Issue')).value('Comment','**Reviewed** carefully.').click('Comment',reg('Issue')).reload().text('Reviewed carefully.',reg('Discussion'))
r=github('EV-1.6','Preview a Markdown file before committing','REQ-4-4','Extend the new-file editor with Preview file rendering Markdown in File preview and Edit file returning to the draft. Preview creates no commit. Commit changes retains the original file validation and permission rules.',
 'main contains README.md with "Initial file". docs/guide.md does not exist.','file-contributor')
r.nav('Add file').nav('Create new file').fill('File name','docs/guide.md').fill('File contents','# Guide EV-1.6\n\n**Useful** documentation.').click('Preview file').see('heading','Guide EV-1.6',reg('File preview')).click('Edit file').value('File contents','# Guide EV-1.6\n\n**Useful** documentation.').fill('Commit message','Add guide EV-1.6').click('Commit changes').reload().text('docs/guide.md')
r=github('EV-1.7','Convert an open pull request to draft','REQ-6-2-4','The author of an unmerged Open PR can use Convert to draft and confirm in Convert to draft. Draft disables merging and preserves branches and content. Ready for review continues to restore Open using the original workflow.',
 '"Draft conversion EV-1.7" is an Open PR by pr-author comparing feature-ev-1.7 to main, with description "Work in progress." and no merge conflicts.','pr-author')
r.pr('Draft conversion EV-1.7').click('Convert to draft',reg('Pull request')).see('dialog','Convert to draft').click('Convert to draft',dlg('Convert to draft')).reload().text('Draft',reg('Pull request')).state('button','Merge pull request','disabled','true',reg('Pull request')).text('Work in progress.',reg('Pull request'))
r=github('EV-1.8','Switch the pull request diff layout','REQ-6-3-2','Files changed adds Diff layout with Unified and Split. The selected layout persists after reload without changing the diff. Split exposes separate Before and After regions; Unified exposes Unified diff. Each contains the corresponding changed source text.',
 '"Layout EV-1.8" is Open, with one changed file src/message.txt replacing "hello before" with "hello after".',difficulty='easy')
r.pr('Layout EV-1.8').nav('Files changed').choose('Diff layout','Split').text('hello before',reg('Before')).text('hello after',reg('After')).reload().selected('Diff layout','Split').choose('Diff layout','Unified').text('-hello before',reg('Unified diff')).text('+hello after',reg('Unified diff'))
r=github('EV-1.9','Search labels before applying one','REQ-5-3-2','The issue Labels picker adds Filter labels. It filters repository labels case-insensitively as typed; applying a result still immediately saves the relationship. A nonmatching label is absent while filtering.',
 '"Label search EV-1.9" is Open and unlabeled. Repository labels are bug, documentation and enhancement.','issue-editor',difficulty='easy')
r.issue('Label search EV-1.9').click('Labels',reg('Issue')).fill('Filter labels','DOC').see('option','documentation').absent('option','bug').click('documentation',role='option').reload().text('documentation',reg('Issue'))
r=github('EV-1.10','Swap comparison branches','REQ-6-2-2','The Compare page adds Swap branches, exchanging Base and Compare without writing either branch. Comparing uses the exchanged selection and shows a persisted Comparison summary after reload.',
 'main and feature-ev-1.10 are distinct branches with differences; file src/compare.txt differs between them.','pr-contributor')
r.nav('Pull requests').nav('New pull request').choose('Base','main').choose('Compare','feature-ev-1.10').click('Swap branches').selected('Base','feature-ev-1.10').selected('Compare','main').click('Compare changes').text('base: feature-ev-1.10; compare: main',reg('Comparison summary')).reload().text('base: feature-ev-1.10; compare: main',reg('Comparison summary'))

# GitHub ADD: twenty scenarios, each mutating only its own EV-suffixed records.
r=github('EV-2.1','Star and unstar a repository',None,'Signed-in users can Star a readable repository. Star count is the number of distinct accounts; Star becomes Unstar. Both changes persist after reload.', 'This repository has no stars.','repo-owner',difficulty='easy',deps=('REQ-3-3','REQ-1-1-2'))
r.click('Star').text('1 star',reg('Repository social')).reload().see('button','Unstar').click('Unstar').reload().text('0 stars',reg('Repository social')).see('button','Star')
r=github('EV-2.2','Keep stars specific to each account',None,'Starring is account-specific: another account sees the aggregate count but retains its own Star action. Signing out preserves the stored star.', 'This repository has no stars.','repo-owner',difficulty='hard',deps=('EV-2.1',))
r.click('Star').logout().login('issue-viewer').repo().see('button','Star').text('1 star',reg('Repository social')).logout().login('repo-owner').repo().see('button','Unstar').text('1 star',reg('Repository social'))
r=github('EV-2.3','Edit repository topics',None,'Admins edit comma-separated Topics through Edit topics. Save trims, deduplicates and lowercases topics; the Topics list persists across navigation. Topic names contain lowercase letters, digits and hyphens.', 'This repository has no topics.','repo-admin',deps=('REQ-3-3',))
r.click('Edit topics').fill('Topics','TypeScript, docs, typescript',dlg('Edit topics')).click('Save',dlg('Edit topics')).order('Topics',['typescript','docs'],reg('About')).home().repo().order('Topics',['typescript','docs'],reg('About'))
r=github('EV-2.4','Restrict topic editing to administrators',None,'Read users can read topic metadata but cannot access Edit topics.', 'Topics are api and docs.','issue-viewer',difficulty='easy',deps=('EV-2.3',))
r.order('Topics',['api','docs'],reg('About')).absent('button','Edit topics').reload().absent('button','Edit topics')
r=github('EV-2.5','Archive a repository',None,'An Admin can Archive repository from General settings and confirm by entering its exact name. Archiving persists and makes repository content read-only, including issue creation; it preserves existing issues.', 'The repository is active with one Open issue "Preserved EV-2.5".','repo-admin',difficulty='hard',deps=('REQ-3-4',))
r.nav('Settings').nav('General').click('Archive repository').fill('Repository name','evolution-EV-2.5',dlg('Archive repository')).click('Archive',dlg('Archive repository')).reload().text('Archived',reg('Repository status')).nav('Issues').see('link','Preserved EV-2.5').absent('link','New issue').absent('button','New issue')
r=github('EV-2.6','Read an archived repository as a visitor',None,'Visitors can browse archived public repositories and issue descriptions; Archived remains visible and New issue is absent.', 'The repository is archived with Open issue "Read only EV-2.6", description "Historical discussion.".',difficulty='easy',deps=('EV-2.5',))
r.text('Archived',reg('Repository status')).issue('Read only EV-2.6').text('Historical discussion.',reg('Issue')).absent('button','Close issue',reg('Issue')).reload().text('Historical discussion.',reg('Issue'))
r=github('EV-2.7','Create a repository label',None,'Admins open Labels from Issues and use New label to create a unique label with Label name, Description and six-digit hex Color. Created labels appear as named regions and are available in issue label pickers.', 'No label named priority-ev-2.7 exists; issue "Apply EV-2.7" is Open and unlabeled.','repo-admin',difficulty='hard',deps=('REQ-5-3-2',))
r.nav('Issues').nav('Labels').click('New label').fill('Label name','priority-ev-2.7',dlg('New label')).fill('Description','Ship this first.',dlg('New label')).fill('Color','#ff8800',dlg('New label')).click('Create label',dlg('New label')).reload().text('Ship this first.',reg('priority-ev-2.7')).nav('Issues').nav('Apply EV-2.7').click('Labels',reg('Issue')).click('priority-ev-2.7',role='option').reload().text('priority-ev-2.7',reg('Issue'))
r=github('EV-2.8','Rename an applied repository label',None,'Admins can Edit a repository label. Renaming updates the label record and all its issue associations atomically without duplicating labels.', 'Label old-ev-2.8 with description "Old description" and color #aaaaaa is applied to "Linked EV-2.8".','repo-admin',difficulty='hard',deps=('EV-2.7',))
r.nav('Issues').nav('Labels').click('Edit',reg('old-ev-2.8')).fill('Label name','renamed-ev-2.8',dlg('Edit label')).fill('Description','New description',dlg('Edit label')).click('Save',dlg('Edit label')).reload().see('region','renamed-ev-2.8').absent('region','old-ev-2.8').nav('Issues').nav('Linked EV-2.8').text('renamed-ev-2.8',reg('Issue'))
r=github('EV-2.9','Create a milestone with a due date',None,'Admins can create milestones on the Milestones page using Title, Description and Due date (YYYY-MM-DD). Newly created milestones become selectable on issue details.', 'No milestone named "Release EV-2.9" exists. "Schedule EV-2.9" is an Open issue without a milestone.','repo-admin',difficulty='hard',deps=('REQ-5-3-3',))
r.nav('Issues').nav('Milestones').click('New milestone').fill('Title','Release EV-2.9',dlg('New milestone')).fill('Description','October delivery',dlg('New milestone')).fill('Due date','2030-10-31',dlg('New milestone')).click('Create milestone',dlg('New milestone')).reload().text('2030-10-31',reg('Release EV-2.9')).nav('Issues').nav('Schedule EV-2.9').click('Milestone',reg('Issue')).click('Release EV-2.9',role='option').reload().text('Release EV-2.9',reg('Issue'))
r=github('EV-2.10','Close and reopen a milestone',None,'Admins may Close milestone and Reopen milestone. Each transition persists without altering title, description, due date or linked issues.', 'Milestone "Cycle EV-2.10" is Open, due 2030-12-01, with description "Preserve scope".','repo-admin',difficulty='easy',deps=('EV-2.9',))
r.nav('Issues').nav('Milestones').click('Close milestone',reg('Cycle EV-2.10')).reload().text('Closed',reg('Cycle EV-2.10')).click('Reopen milestone',reg('Cycle EV-2.10')).reload().text('Open',reg('Cycle EV-2.10')).text('Preserve scope',reg('Cycle EV-2.10'))
r=github('EV-3.1','Lock an issue conversation',None,'Admins can Lock conversation, select Lock reason and confirm Lock. A locked issue persists its reason; ordinary Write users cannot add comments until an Admin unlocks it. Existing discussion remains readable.', '"Lock EV-3.1" is Open and unlocked, with description "Retain context.".','repo-admin',difficulty='hard',deps=('REQ-5-2-3',))
r.issue('Lock EV-3.1').click('Lock conversation',reg('Issue')).choose('Lock reason','Off-topic',dlg('Lock conversation')).click('Lock',dlg('Lock conversation')).reload().text('Locked: Off-topic',reg('Issue')).logout().login('issue-commenter').repo().issue('Lock EV-3.1').absent('button','Comment',reg('Issue')).text('Retain context.',reg('Issue'))
r=github('EV-3.2','Deny issue locking to a read user',None,'Only Admins manage conversation locks. Read users see neither Lock conversation nor Unlock conversation, while issue content is readable.', '"Lock permission EV-3.2" is Open, unlocked, with description "Readable content.".','issue-viewer',difficulty='easy',deps=('EV-3.1',))
r.issue('Lock permission EV-3.2').text('Readable content.',reg('Issue')).absent('button','Lock conversation',reg('Issue')).absent('button','Unlock conversation',reg('Issue')).reload().absent('button','Lock conversation',reg('Issue'))
r=github('EV-3.3','Pin an issue to the repository list',None,'Admins can Pin issue. Pinned issues displays pinned issue titles in pin order above the normal issue list. Pinning persists after leaving the repository.', '"Pinned EV-3.3" is Open and unpinned; no other issue is pinned.','repo-admin',deps=('REQ-5-1-1','REQ-5-1-2'))
r.issue('Pinned EV-3.3').click('Pin issue',reg('Issue')).home().repo().nav('Issues').order('Pinned issue titles',['Pinned EV-3.3'],reg('Pinned issues'))
r=github('EV-3.4','Unpin an issue without deleting it',None,'Admins can Unpin issue. Removing a pin removes only the pin relationship; the ordinary issue list and discussion remain.', '"Unpin EV-3.4" is Open and pinned, with description "Keep this issue.".','repo-admin',deps=('EV-3.3',))
r.issue('Unpin EV-3.4').click('Unpin issue',reg('Issue')).reload().see('button','Pin issue',reg('Issue')).nav('Issues').order('Pinned issue titles',[],reg('Pinned issues')).see('link','Unpin EV-3.4',reg('Issues'))
r=github('EV-3.5','Toggle a thumbs-up reaction',None,'Signed-in readers can toggle a Thumbs up reaction on an issue. The button exposes pressed state, Reaction count shows the distinct account count, and reload preserves both.', '"React EV-3.5" is Open with no reactions.','issue-viewer',difficulty='easy',deps=('REQ-5-1-2',))
r.issue('React EV-3.5').click('Thumbs up',reg('Issue')).state('button','Thumbs up','pressed','true',reg('Issue')).text('1 reaction',reg('Reaction count')).reload().state('button','Thumbs up','pressed','true',reg('Issue')).click('Thumbs up',reg('Issue')).text('0 reactions',reg('Reaction count'))
r=github('EV-3.6','Create and use a saved reply',None,'A signed-in account manages Saved replies from its Account menu. New saved reply stores a Reply title and Reply body for that account. Insert saved reply on an issue copies the selected body into Comment without publishing it; publishing uses Comment.', '"Reply EV-3.6" is Open with no comments. issue-commenter has no saved reply "Thanks EV-3.6".','issue-commenter',difficulty='hard',deps=('REQ-5-2-3',))
r.click('Account menu').nav('Saved replies').click('New saved reply').fill('Reply title','Thanks EV-3.6',dlg('Saved reply')).fill('Reply body','Thanks for the reproducible example.',dlg('Saved reply')).click('Save',dlg('Saved reply')).home().repo().issue('Reply EV-3.6').click('Insert saved reply',reg('Issue')).click('Thanks EV-3.6',role='option').value('Comment','Thanks for the reproducible example.').click('Comment',reg('Issue')).reload().text('Thanks for the reproducible example.',reg('Discussion'))
r=github('EV-3.7','Edit an authored issue comment',None,'A comment author can Edit comment within that discussion article, change Comment body and Save comment. The updated body and Edited indicator persist with the original author.', '"Edit comment EV-3.7" has exactly one comment with body "Original comment EV-3.7", by issue-commenter, whose article accessible name is "Comment by issue-commenter".','issue-commenter',deps=('REQ-5-2-3',))
r.issue('Edit comment EV-3.7').click('Edit comment',scope('article','Comment by issue-commenter')).fill('Comment body','Revised comment EV-3.7',dlg('Edit comment')).click('Save comment',dlg('Edit comment')).reload().text('Revised comment EV-3.7',scope('article','Comment by issue-commenter')).text('Edited',scope('article','Comment by issue-commenter')).absent('button','Save comment')
r=github('EV-3.8','Confirm deletion of an authored comment',None,'A comment author can Delete comment. Cancel preserves the comment; Delete confirms removal. Deletion persists and leaves the issue description intact.', '"Delete comment EV-3.8" has description "Keep the issue body." and one issue-commenter comment "Disposable EV-3.8" in article "Comment by issue-commenter".','issue-commenter',deps=('REQ-5-2-3',))
r.issue('Delete comment EV-3.8').click('Delete comment',scope('article','Comment by issue-commenter')).click('Cancel',dlg('Delete comment')).text('Disposable EV-3.8',reg('Discussion')).click('Delete comment',scope('article','Comment by issue-commenter')).click('Delete',dlg('Delete comment')).reload().absent('article','Comment by issue-commenter',reg('Discussion')).text('Keep the issue body.',reg('Issue'))
r=github('EV-3.9','Complete an issue task-list item',None,'Markdown task-list items in an issue description render as labelled checkboxes. Write users can toggle them; the saved Markdown and task progress update together and persist. Other text and tasks remain unchanged.', '"Checklist EV-3.9" has description "- [ ] Add tests\n- [ ] Update docs" and no completed tasks.','issue-editor',deps=('REQ-5-2-2',))
r.issue('Checklist EV-3.9').check('Add tests',True,reg('Issue')).text('1 of 2 tasks complete',reg('Issue')).reload().state('checkbox','Add tests','checked','true',reg('Issue')).state('checkbox','Update docs','checked','false',reg('Issue')).click('Edit issue description',reg('Issue')).value('Issue description','- [x] Add tests\n- [ ] Update docs')
r=github('EV-3.10','Resolve and reopen a review thread',None,'Review participants and PR authors can Resolve conversation and Unresolve conversation on a review thread. Resolution persists and preserves every comment; it does not change PR status or approval decisions.', '"Resolve EV-3.10" is an Open PR by pr-author. Files changed contains unresolved thread "Thread EV-3.10" with pr-reviewer comment "Handle the empty case." on src/search.ts.','pr-reviewer',deps=('REQ-6-3-3',))
r.pr('Resolve EV-3.10').nav('Files changed').click('Resolve conversation',reg('Thread EV-3.10')).reload().text('Resolved',reg('Thread EV-3.10')).text('Handle the empty case.',reg('Thread EV-3.10')).click('Unresolve conversation',reg('Thread EV-3.10')).reload().see('button','Resolve conversation',reg('Thread EV-3.10'))

# Sheet CHANGE.
r=sheet('EV-1.1','Calculate IF with a comparison','REQ-4-1-1','Extend formulas with IF(condition, true_value, false_value), comparisons and quoted string literals. IF evaluates only the selected branch. Existing arithmetic and aggregates remain valid.', 'A1=12 and B1 is blank.')
r.edit('B1','=IF(A1>=10,"Ready","Wait")').cell('B1','Ready').edit('A1','4').cell('B1','Wait').reload().cell('B1','Wait').click('B1',GRID,'gridcell').value('Formula bar','=IF(A1>=10,"Ready","Wait")')
r=sheet('EV-1.2','Count matching values with COUNTIF','REQ-4-1-1','COUNTIF(range, criterion) counts matching cells; criteria support numeric comparison prefixes and exact case-insensitive text. Results recalculate on source edits.', 'A1=5, A2=10, A3=15, A4=20. B1 is blank.')
r.edit('B1','=COUNTIF(A1:A4,">10")').cell('B1','2').edit('A2','11').cell('B1','3').reload().cell('B1','3')
r=sheet('EV-1.3','Sum matching rows with SUMIF','REQ-4-1-1','SUMIF(criteria_range, criterion, sum_range) sums numeric values whose corresponding criteria match case-insensitive text or numeric comparisons; nonmatching values do not contribute.', 'A1=East, A2=West, A3=East; B1=12, B2=99, B3=8.')
r.edit('C1','=SUMIF(A1:A3,"East",B1:B3)').cell('C1','20').edit('B2','1000').cell('C1','20').reload().cell('C1','20')
r=sheet('EV-1.4','Recover from formula errors with IFERROR','REQ-4-2-2','IFERROR(expression, fallback) returns fallback only when the expression errors. Source correction restores the ordinary result without changing the expression; unrelated errors remain visible.', 'A1=0 and C1 has formula =1/0.')
r.edit('B1','=IFERROR(10/A1,"Pending")').cell('B1','Pending').cell('C1','#DIV/0!').edit('A1','2').cell('B1','5').reload().cell('B1','5').cell('C1','#DIV/0!')
r=sheet('EV-1.5','Recalculate cross-worksheet references','REQ-4-2-1','Extend references to SheetName!A1 and single-quoted worksheet names. Source edits in another worksheet recalculate dependents and persist without leaking worksheet content.', 'Tabs are Sheet1 and Rates; Sheet1!A1=10, Rates!A1=2. Sheet1 is active.',difficulty='hard')
r.edit('B1',"=A1*'Rates'!A1").cell('B1','20').click('Rates',role='tab').edit('A1','3').click('Sheet1',role='tab').cell('B1','30').reload().cell('B1','30')
r=sheet('EV-1.6','Sort by a secondary column','REQ-5-1-1','Sort range adds optional Then by (default None) and Then order. Rows tie on the primary key before the secondary key is used; headers and outside cells remain unchanged.', 'A1=Team,B1=Score; A2=Blue,B2=5; A3=Red,B3=3; A4=Blue,B4=9; D1=Sentinel.')
r.drag('A1','B4').click('Data').click('Sort range',role='menuitem').check('Data has header row',True,dlg('Sort range')).choose('Sort by','Team',dlg('Sort range')).choose('Order','Ascending',dlg('Sort range')).choose('Then by','Score',dlg('Sort range')).choose('Then order','Descending',dlg('Sort range')).click('Sort',dlg('Sort range')).cell('A2','Blue').cell('B2','9').cell('B3','5').cell('A4','Red').cell('D1','Sentinel').reload().cell('B2','9')
r=sheet('EV-1.7','Allow invalid input with a validation warning','REQ-5-2-1','Data validation adds On invalid data with Reject input (default) and Show warning. Show warning commits invalid input and displays Validation warning for the selected invalid cell; the rule and value persist. Reject input retains original atomic rejection.', 'A1=5.')
r.click('A1',GRID,'gridcell').click('Data').click('Data validation',role='menuitem').choose('Rule type','Number range',dlg('Data validation')).fill('Minimum','0',dlg('Data validation')).fill('Maximum','10',dlg('Data validation')).choose('On invalid data','Show warning',dlg('Data validation')).click('Save',dlg('Data validation')).edit('A1','12').cell('A1','12').text('Validation warning').reload().cell('A1','12').click('Data').click('Data validation',role='menuitem').selected('On invalid data','Show warning',dlg('Data validation'))
r=sheet('EV-1.8','Paste only calculated values','REQ-3-2-1','The grid context menu adds Paste values only. It pastes the copied range\'s calculated values, preserving layout while removing formulas in targets. The source remains unchanged and normal Paste still copies formulas.', 'A1=7; B1 has formula =A1*2; D1 is blank.')
r.click('B1',GRID,'gridcell').key('gridcell','B1','Control+c',GRID).context('gridcell','D1',GRID).click('Paste values only',role='menuitem').cell('D1','14').click('D1',GRID,'gridcell').value('Formula bar','14').edit('A1','8').cell('B1','16').cell('D1','14').reload().cell('D1','14')
r=sheet('EV-1.9','Undo and redo a worksheet rename','REQ-3-2-2','Extend workbook session undo history to worksheet renaming. Undo restores the previous tab name and data; Redo reapplies the name. The visible state after redo persists.', 'Sheet1!A1=Preserved.',difficulty='easy')
r.click('Worksheet options for Sheet1').click('Rename',role='menuitem').fill('Worksheet name','Renamed EV-1.9',dlg('Rename worksheet')).click('Save',dlg('Rename worksheet')).click('Undo').see('tab','Sheet1').absent('tab','Renamed EV-1.9').cell('A1','Preserved').click('Redo').see('tab','Renamed EV-1.9').reload().see('tab','Renamed EV-1.9').cell('A1','Preserved')
r=sheet('EV-1.10','Concatenate cell text in a formula','REQ-4-1-1','Extend formula expressions with the & text concatenation operator and quoted strings. Number operands convert to their displayed text; dependency edits recalculate the result.', 'A1=Order, B1=42.')
r.edit('C1','=A1&" #"&B1').cell('C1','Order #42').edit('B1','43').cell('C1','Order #43').reload().cell('C1','Order #43')

# Sheet ADD.
r=sheet('EV-2.1','Create a named range for formulas',None,'Data > Named ranges opens a Named ranges region. Add named range opens a dialog with Name and Range (A1 notation on the active worksheet). Names are workbook-scoped and case-insensitive; formulas resolve them. Save persists range definitions.', 'A1=2,A2=3,A3=5.',deps=('REQ-4-1-1',))
r.click('Data').click('Named ranges',role='menuitem').click('Add named range',reg('Named ranges')).fill('Name','Revenue',dlg('Named range')).fill('Range','A1:A3',dlg('Named range')).click('Save',dlg('Named range')).edit('B1','=SUM(Revenue)').cell('B1','10').reload().cell('B1','10')
r=sheet('EV-2.2','Rename a named range and its references',None,'Edit on a named range allows renaming. Existing formulas referencing that name are updated to the new name atomically; their calculated values remain unchanged.', 'A1=4,A2=6; named range Revenue refers to Sheet1!A1:A2; B1 has formula =SUM(Revenue).',difficulty='hard',deps=('EV-2.1',))
r.click('Data').click('Named ranges',role='menuitem').click('Edit',reg('Revenue')).fill('Name','SalesTotal',dlg('Named range')).click('Save',dlg('Named range')).cell('B1','10').click('B1',GRID,'gridcell').value('Formula bar','=SUM(SalesTotal)').reload().cell('B1','10').value('Formula bar','=SUM(SalesTotal)')
r=sheet('EV-2.3','Delete a named range without deleting data',None,'Delete on a named range opens Delete named range confirmation. Removing the definition preserves cells but unresolved formulas show #NAME? and retain their expression.', 'A1=4,A2=6; Revenue refers to Sheet1!A1:A2; B1 has formula =SUM(Revenue).',deps=('EV-2.1',))
r.click('Data').click('Named ranges',role='menuitem').click('Delete',reg('Revenue')).click('Delete',dlg('Delete named range')).cell('A1','4').cell('A2','6').cell('B1','#NAME?').reload().cell('B1','#NAME?').click('B1',GRID,'gridcell').value('Formula bar','=SUM(Revenue)')
r=sheet('EV-2.4','Find case-sensitive text',None,'Find and replace opens a dialog. Find next searches the active worksheet in row-major order with optional Match case; it selects the matching cell and displays Match <coordinate>. It wraps after the last match and never changes data.', 'A1=alpha, B2=Alpha, C3=ALPHA.',difficulty='easy',deps=('REQ-3-1-3',))
r.click('Find and replace').fill('Find','Alpha',dlg('Find and replace')).check('Match case',True,dlg('Find and replace')).click('Find next',dlg('Find and replace')).text('Match B2',dlg('Find and replace')).click('Close',dlg('Find and replace')).state('gridcell','B2','selected','true',GRID).cell('A1','alpha')
r=sheet('EV-2.5','Replace all text on the active worksheet',None,'Replace all replaces literal matches on the active worksheet only, honoring Match case. It reports the number of replacements and persists all changes atomically; other worksheets remain unchanged.', 'Tabs are Sheet1 and Other. Sheet1 has A1=cat, A2=catfish, A3=dog; Other!A1=cat. Sheet1 is active.',deps=('EV-2.4',))
r.click('Find and replace').fill('Find','cat',dlg('Find and replace')).fill('Replace with','fox',dlg('Find and replace')).click('Replace all',dlg('Find and replace')).text('2 replacements',dlg('Find and replace')).click('Close',dlg('Find and replace')).cell('A1','fox').cell('A2','foxfish').click('Other',role='tab').cell('A1','cat').click('Sheet1',role='tab').reload().cell('A2','foxfish')
r=sheet('EV-2.6','Replace text inside formulas',None,'Search in formulas makes Find and replace operate on original expressions as well as ordinary text. Replacement recalculates formulas. With this option off, formula expressions are not modified by Replace all.', 'A1=2,A2=5; B1 has formula =A1*2 and B2 has formula =A1+1.',deps=('EV-2.4',))
r.click('Find and replace').fill('Find','A1',dlg('Find and replace')).fill('Replace with','A2',dlg('Find and replace')).check('Search in formulas',True,dlg('Find and replace')).click('Replace all',dlg('Find and replace')).text('2 replacements',dlg('Find and replace')).click('Close',dlg('Find and replace')).cell('B1','10').cell('B2','6').reload().cell('B1','10').click('B1',GRID,'gridcell').value('Formula bar','=A2*2')
r=sheet('EV-2.7','Duplicate a worksheet independently',None,'Duplicate in the worksheet tab menu creates and activates Copy of <name> immediately after the source. It copies values, formulas and validation rules with independent identities. Later edits do not affect the source.', 'Sheet1 has A1=5,B1 formula =A1*2; A1 has Reject input numeric validation from 0 to 10.',difficulty='hard',deps=('REQ-2-1-1','REQ-5-2-1'))
r.click('Worksheet options for Sheet1').click('Duplicate',role='menuitem').see('tab','Copy of Sheet1').cell('B1','10').edit('A1','8').cell('B1','16').click('Sheet1',role='tab').cell('A1','5').cell('B1','10').click('Copy of Sheet1',role='tab').reload().cell('A1','8').click('Data').click('Data validation',role='menuitem').value('Maximum','10',dlg('Data validation'))
r=sheet('EV-2.8','Hide a worksheet without losing its data',None,'Hide in the worksheet tab menu hides the selected worksheet and activates an adjacent visible worksheet. At least one sheet stays visible. Hidden worksheet data persists and is available through Hidden sheets.', 'Tabs are Sheet1 and Archive; Sheet1!A1=Current, Archive!A1=Retained. Archive is active.',deps=('REQ-2-1-2',))
r.click('Worksheet options for Archive').click('Hide',role='menuitem').absent('tab','Archive').state('tab','Sheet1','selected','true').cell('A1','Current').reload().absent('tab','Archive').click('Hidden sheets').see('button','Show Archive',dlg('Hidden sheets'))
r=sheet('EV-2.9','Show a hidden worksheet',None,'Hidden sheets lists each hidden sheet as Show <name>. Showing restores its original tab order and activates it with its data intact.', 'Sheet1 is visible and active with A1=Current. Archive follows it, hidden, with A1=Retained.',difficulty='easy',deps=('EV-2.8',))
r.click('Hidden sheets').click('Show Archive',dlg('Hidden sheets')).state('tab','Archive','selected','true').cell('A1','Retained').reload().see('tab','Archive').cell('A1','Retained')
r=sheet('EV-2.10','Move a worksheet left',None,'Move left in a worksheet tab menu moves it one position left without changing its data or active state. Worksheet order is reflected by the Worksheet order list and survives reopening.', 'Visible tabs are Sheet1, Second, Third in that order; Third is active with A1=Third data. Other sheets are blank.',difficulty='easy',deps=('REQ-2-1-2',))
r.click('Worksheet options for Third').click('Move left',role='menuitem').order('Worksheet order',['Sheet1','Third','Second']).cell('A1','Third data').reload().order('Worksheet order',['Sheet1','Third','Second']).state('tab','Third','selected','true')
r=sheet('EV-3.1','Attach a note to a cell',None,'Insert note opens Cell note for the selected cell with Note and Save. A saved note adds Show note for <coordinate>, which reopens the saved note without altering the cell value.', 'A1=42.',difficulty='easy',deps=('REQ-3-1-1',))
r.click('A1',GRID,'gridcell').click('Insert note').fill('Note','Verified total EV-3.1',dlg('Cell note')).click('Save',dlg('Cell note')).reload().click('Show note for A1').value('Note','Verified total EV-3.1',dlg('Cell note')).click('Close',dlg('Cell note')).cell('A1','42')
r=sheet('EV-3.2','Edit then remove a cell note',None,'An existing Cell note supports Save and Delete note. Removing a note leaves its cell value unchanged and removes the Show note control after reload.', 'A1=42 with note "Old note EV-3.2".',deps=('EV-3.1',))
r.click('Show note for A1').fill('Note','Updated note EV-3.2',dlg('Cell note')).click('Save',dlg('Cell note')).reload().click('Show note for A1').value('Note','Updated note EV-3.2',dlg('Cell note')).click('Delete note',dlg('Cell note')).reload().absent('button','Show note for A1').cell('A1','42')
r=sheet('EV-3.3','Trim whitespace only in the selection',None,'Data > Trim whitespace removes leading and trailing ASCII spaces and collapses internal runs of ASCII spaces to one in selected ordinary text cells. Formulas and cells outside the selection remain unchanged. The operation is undoable.', 'A1="  North   East  ", A2="  West  ", B1="  Outside  ".',deps=('REQ-3-1-3','REQ-3-2-2'))
r.drag('A1','A2').click('Data').click('Trim whitespace',role='menuitem').cell('A1','North East').cell('A2','West').cell('B1','  Outside  ').click('A1',GRID,'gridcell').value('Formula bar','North East').click('A2',GRID,'gridcell').value('Formula bar','West').click('B1',GRID,'gridcell').value('Formula bar','  Outside  ').click('Undo').click('A1',GRID,'gridcell').value('Formula bar','  North   East  ').click('Redo').reload().cell('A1','North East').click('A1',GRID,'gridcell').value('Formula bar','North East')
r=sheet('EV-3.4','Split a selected column by a delimiter',None,'Data > Split text to columns opens a dialog with Separator. Comma splits each selected cell into adjacent columns, preserving empty fields and row order. It commits as one undoable operation.', 'A1="red,green,blue", A2="one,,three"; D1=Outside. Destination B1:C2 is blank.',deps=('REQ-3-1-3','REQ-3-2-2'))
r.drag('A1','A2').click('Data').click('Split text to columns',role='menuitem').choose('Separator','Comma',dlg('Split text to columns')).click('Split',dlg('Split text to columns')).cell('A1','red').cell('B1','green').cell('C1','blue').cell('B2','').cell('C2','three').cell('D1','Outside').reload().cell('C2','three')
r=sheet('EV-3.5','Remove duplicate records from a range',None,'Data > Remove duplicates opens a dialog with Data has header row and Remove duplicates. It compares all selected columns using exact values, keeps the first record in order, clears trailing cells inside the selected rectangle and leaves outside cells unchanged.', 'A1=Name,B1=Count; A2=Apple,B2=2; A3=Pear,B3=3; A4=Apple,B4=2; D4=Outside.',deps=('REQ-3-1-3',))
r.drag('A1','B4').click('Data').click('Remove duplicates',role='menuitem').check('Data has header row',True,dlg('Remove duplicates')).click('Remove duplicates',dlg('Remove duplicates')).text('1 duplicate removed').cell('A1','Name').cell('A2','Apple').cell('A3','Pear').cell('A4','').cell('B4','').cell('D4','Outside').reload().cell('A3','Pear')
r=sheet('EV-3.6','Freeze the top worksheet row',None,'View > Freeze rows opens Freeze rows with Rows to freeze, a nonnegative integer. Save keeps that many top rows fixed during vertical grid scrolling. Frozen rows reports the persisted setting, independently for each worksheet.', 'Tabs are Sheet1 and Other; Sheet1!A1=Header, Other!A1=Other data. No rows are frozen.',deps=('REQ-2-1-2',))
r.click('View').click('Freeze rows',role='menuitem').fill('Rows to freeze','1',dlg('Freeze rows')).click('Save',dlg('Freeze rows')).text('1 row frozen',reg('Frozen rows')).reload().text('1 row frozen',reg('Frozen rows')).click('Other',role='tab').text('0 rows frozen',reg('Frozen rows')).click('Sheet1',role='tab').text('1 row frozen',reg('Frozen rows'))
r=sheet('EV-3.7','Hide a column without deleting its values',None,'Hide column in a column-header menu hides that column and its cells while retaining their data and formula references. Show column <letter> appears for each hidden column.', 'A1=2,B1=8,C1 has formula =A1+B1.',deps=('REQ-2-2-2',))
r.context('columnheader','B',GRID).click('Hide column',role='menuitem').absent('columnheader','B',GRID).absent('gridcell','B1',GRID).cell('C1','10').reload().absent('gridcell','B1',GRID).see('button','Show column B')
r=sheet('EV-3.8','Show a hidden column',None,'Show column <letter> restores a hidden column in its original position, preserving values and formulas. Restoration persists.', 'A1=2,B1=8,C1 has formula =A1+B1; column B is hidden.',difficulty='easy',deps=('EV-3.7',))
r.click('Show column B').see('columnheader','B',GRID).cell('B1','8').cell('C1','10').reload().cell('B1','8')
r=sheet('EV-3.9','Toggle display of formula expressions',None,'View > Show formulas is a menuitemcheckbox. Checked displays original expressions in formula cells; unchecked displays calculated values. It changes only presentation and persists for the current worksheet.', 'A1=3,B1 has formula =A1*4.',difficulty='easy',deps=('REQ-4-1-1',))
r.click('View').click('Show formulas',role='menuitemcheckbox').cell('B1','=A1*4').cell('A1','3').reload().cell('B1','=A1*4').click('View').state('menuitemcheckbox','Show formulas','checked','true').click('Show formulas',role='menuitemcheckbox').cell('B1','12')
r=sheet('EV-3.10','Make an independent workbook copy',None,'Make a copy opens Copy workbook with Workbook name and Create copy. It copies all worksheets, formulas, notes and rules into a new workbook, opens that workbook and retains the original unchanged.', 'A1=6,B1 has formula =A1*3. No workbook named "Independent EV-3.10" exists.',difficulty='hard',deps=('REQ-1-2-1','REQ-1-1-1'))
r.click('Make a copy').fill('Workbook name','Independent EV-3.10',dlg('Copy workbook')).click('Create copy',dlg('Copy workbook')).see('heading','Independent EV-3.10').edit('A1','7').cell('B1','21').home().nav('Make EV-3.10').cell('A1','6').cell('B1','18').home().nav('Independent EV-3.10').reload().cell('B1','21')

CONTRACT='''Benchmark interaction contract: Every scenario starts at the application home entry in a fresh browser context, signed out. Authentication, when required, uses the original Sign in link, Username or email and masked Password inputs, and Sign in button. Navigation controls may be links or buttons with the exact accessible names stated below; form actions are buttons. Every named control or landmark is unique within its stated scope and visible when used. Inputs have associated labels matching the stated names. Named regions and dialogs expose those accessible roles and names. Native or custom selectors expose combobox and option semantics; a collapsed custom selector displays only the selected option. Lists expose list and listitem semantics in reading order. Status and alert messages have matching accessible names and visible text. Checked, selected and pressed states use their corresponding ARIA/native semantics. An absent control has zero matching accessible elements. Seed records described in GIVEN steps exist in the initial application state, rather than being created by another test. All EV-suffixed resources are distinct records; mutations affect only the current scenario's records. Original accounts and credentials are reused without changing credentials or shared account preferences. All 30 scenarios must work in any order on one continuously running application with a fresh browser context per test and no server reset. Persistence means saved application data survives navigation and reload. No private setup API, implementation-specific URL, framework, database key, CSS selector or particular markup structure is required. Preserve all original behavior except the explicitly described extension; unchanged controls retain their original names and semantics.'''

class Dumper(yaml.SafeDumper): pass
def string_representer(dumper,data):return dumper.represent_scalar('tag:yaml.org,2002:str',data,style='|' if '\n' in data else None)
Dumper.add_representer(str,string_representer)

if __name__=='__main__':
    for task,requirements in TASKS.items():
        assert len(requirements)==30
        intro=("Light evolution requirements for the participant's actual GitHub-like finals base. Extend issue discovery, repository metadata, discussion management and pull-request review. Actions, Packages, Wiki, project boards, notification delivery, real-time collaboration and external Git protocols remain out of scope." if task=='github' else "Light evolution requirements for the participant's actual spreadsheet finals base. Extend formulas, data cleanup and workbook organization. This remains a public single-user workspace: no account credentials exist in the original sheet task. Sharing, real-time collaboration, advanced styling, charts, macros and external office integrations remain out of scope.")
        node={'id':'ROOT','name':f'{task.title()} Finals Proxy Evolution Light','type':'FOLDER','description':intro+'\n\n'+CONTRACT,'dependencies':[],'children':[r.emit() for r in requirements]}
        (ROOT/task/'requirements/requirements.yaml').write_text(yaml.dump(node,Dumper=Dumper,sort_keys=False,allow_unicode=True,width=100),encoding='utf-8')
    (ROOT/'scripts/difficulties.json').write_text(json.dumps(DIFFICULTIES,indent=2)+'\n')
