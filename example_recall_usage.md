# Example: Claude Using the Recall Tool

## Scenario: Long Debugging Session

### Early Conversation (Turns 1-25)
```
User: I'\''m getting a weird error with my database connection pool

Claude: Let me help you debug this...
[Detailed discussion about connection pooling, timeout settings, 
 max_connections parameter, PostgreSQL configuration, etc.]

User: OK it'\''s fixed! The issue was max_overflow=10 was too low

Claude: Great! Setting max_overflow=20 should prevent pool exhaustion.
```

### Middle Conversation (Turns 26-50)
```
User: Now let'\''s work on the frontend React components

Claude: Sure! Let'\''s start with the authentication flow...
[Long discussion about React hooks, context providers, 
 JWT storage, protected routes, etc.]
```

### Later Conversation (Turns 51-75)
```
User: Let'\''s deploy this with Docker

Claude: I'\''ll help you create docker-compose...
[Discussion about container orchestration, volumes, 
 environment variables, health checks, etc.]
```

### 🎯 The Critical Moment (Turn 76)

```
User: The connection pool is exhausted again in production!
```

## What Happens:

### Step 1: Automatic Recall (Built-in)

Nanoagent automatically searches for: `"The connection pool is exhausted again in production!"`

**Problem**: This query focuses on "production" and "exhausted" - but we need the **solution** we discussed 50 turns ago!

Automatic recall might return:
```
## What I remember from earlier:

You deployed the application to production using Docker with environment 
variables for database credentials and health checks for container monitoring.
```

❌ **Not helpful** - this is about Docker, not the connection pool fix!

### Step 2: Claude Recognizes the Gap

Claude'\''s reasoning:
```
The user mentioned "connection pool exhausted AGAIN" - this implies we 
discussed it before. The automatic recall gave me Docker deployment info,
but I need the specific database pooling configuration we discussed earlier.
Let me search more specifically.
```

### Step 3: Claude Uses Recall Tool

```xml
<function_calls>
<invoke name="recall">
<parameter name="query">database connection pool max_overflow parameter PostgreSQL configuration fix
