const statusDiv = document.getElementById('status');
const reportDiv = document.getElementById('report');
const aiService = new window.AIService();

async function generateRundown() {
  try {
    statusDiv.textContent = "Fetching unread emails...";
    
    // Query for unread messages. 
    // We might want to filter by date but 'unread' is the primary criteria requested.
    const messages = await messenger.messages.query({ unread: true });
    
    // Convert to regular array and sort by date descending manually to be safe, 
    // though query usually returns in order.
    // messages.messages is the array (MessageList object acts like array but let's be safe)
    let msgList = [];
    if (messages.messages) {
        for (let m of messages.messages) {
            msgList.push(m);
        }
    } else {
        // Depending on Thunderbird version, might be async iterator or direct array
        // But WebExtension API usually returns MessageList
        // Let's iterate the MessageList
        let page = messages;
        while (page) {
             for (let m of page.messages) {
                 msgList.push(m);
             }
             if (page.id) {
                 // It has more pages, but for rundown let's limit to first page or first N
                 // to avoid fetching thousands.
                 break; 
             } else {
                 break;
             }
        }
    }

    if (msgList.length === 0) {
      statusDiv.textContent = "No unread emails found.";
      return;
    }

    // Sort by date desc
    msgList.sort((a, b) => b.date - a.date);

    // Limit to top 30 to fit in context
    const limit = 30;
    const topMessages = msgList.slice(0, limit);
    
    statusDiv.textContent = `Analyzing ${topMessages.length} unread emails...`;

    // Prepare data for AI
    const emailData = topMessages.map(m => {
      // Clean author
      let author = m.author || 'Unknown';
      if (author.includes('<')) {
        author = author.split('<')[0].replace(/"/g, '').trim();
      }
      
      return `- [${new Date(m.date).toLocaleDateString()}] From: ${author}, Subject: ${m.subject}`;
    }).join('\n');

    const config = await browser.storage.local.get('rundownLang');
    let langInstruction = '';
    if (config.rundownLang) {
        langInstruction = `\n\n**Language Requirement:**\nPlease write the entire summary in **${config.rundownLang}**.\n`;
    }

    const prompt = `Here is a list of unread emails. Please provide a "Daily Rundown" summary.
    **Instructions:**
    ${langInstruction}

    1. **Categorization**: Group emails into relevant categories such as:
      - Urgent/Time-Sensitive
      - Action Required
      - Important Updates
      - Meetings & Calendar
      - FYI/Informational
      - Low Priority

    2. **Formatting Requirements**:
      - Use "###" for section headers (maximum 3 hierarchy levels)
      - Use "- " for list items
      - Use **bold** for key senders, urgent items, and critical information
      - Keep summaries concise (1-2 sentences per email)

    3. **Content Guidelines**:
      - Identify and highlight time-sensitive items
      - Extract key action items or deadlines
      - Note important senders (executives, clients, team leads)
      - Summarize the main point of each email
      - Flag anything requiring immediate attention

    4. **Output Structure**:
    ### [Category Name]
    - **[Sender Name]**: [Brief summary of email content]
    - **[Sender Name]**: [Brief summary with deadline/action if applicable]

    ### [Next Category]
    ...

    5. **Prioritization Logic**:
    - Emails with deadlines or time constraints go first
    - Direct requests or questions requiring response
    - Updates from leadership or key stakeholders
    - General announcements and newsletters last

    **Example Output Format:**

    ### Urgent/Time-Sensitive
    - **Sarah Chen (VP Sales)**: Q4 revenue report needs your review and approval by EOD today
    - **IT Security**: Password reset required within 24 hours to maintain system access

    ### Action Required
    - **Project Team**: Feedback requested on new feature proposal by Friday
    - **HR Department**: Benefits enrollment deadline extended to next Monday

    ### Important Updates
    - **CEO Office**: Company all-hands meeting scheduled for Thursday 2pm
    - **Marketing**: New brand guidelines released, review at your convenience

    Please provide clear, scannable summaries that help the recipient quickly understand what needs attention and what can wait.
        
    
    List:
    ${emailData}`;

    const report = await aiService.generate(prompt, "You are a helpful executive assistant specialized in email productivity.");
    
    statusDiv.style.display = 'none';
    
    // safe parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(parseMarkdown(report), 'text/html');
    reportDiv.innerHTML = '';
    // Append children safely
    while (doc.body.firstChild) {
        reportDiv.appendChild(doc.body.firstChild);
    }

  } catch (err) {
    console.error(err);
    statusDiv.textContent = '';
    reportDiv.innerHTML = '';
    const errDiv = document.createElement('div');
    errDiv.className = 'error';
    errDiv.textContent = `Error: ${err.message}`;
    reportDiv.appendChild(errDiv);
  }
}

function parseMarkdown(text) {
  let html = text
    // Header 3
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    // Header 2
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // List items
    .replace(/^\- (.*$)/gim, '<li>$1</li>');
  
  // Wrap lists in <ul> (simple heuristic: if we have <li>s, wrap groups of them)
  // Or just rely on browser being forgiving or standard block spacing.
  // Better: replace newlines with <br> for non-list items or paragraphs.
  
  // Simple rendering: split by lines
  return html.split('\n').map(line => {
    if (line.includes('<h3>') || line.includes('<h2>') || line.includes('<li>')) {
        return line;
    }
    if (line.trim() === '') return '';
    return `<p>${line}</p>`;
  }).join('');
}

// Start immediately
generateRundown();
