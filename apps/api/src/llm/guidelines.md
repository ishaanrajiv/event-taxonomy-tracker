# Event Generation Guidelines

## Naming Conventions

### Event Names
- **MUST** be in Title Case (every major word capitalized)
- Should describe a completed action in past tense
- Examples:
  - ✅ "Checkout Started"
  - ✅ "Item Added To Cart"
  - ✅ "User Signed Up"
  - ❌ "checkout_started" (not title case)
  - ❌ "Adding Item" (not past tense)

### Property Names
- **MUST** be in Title Case (every major word capitalized, no underscores)
- Should be descriptive but concise
- Examples:
  - ✅ `Cart ID`
  - ✅ `Item Name`
  - ✅ `User ID`
  - ✅ `Is Premium Member`
  - ❌ `cart_id` (not title case)
  - ❌ `CART_ID` (all caps, not title case)

## Property Types

Choose the appropriate property type based on the data's scope:

- **`event`**: Properties specific to this particular event
  - Examples: `Cart ID`, `Item Name`, `Checkout Total`, `Payment Method`
  - Use when: The property is unique to this event's context

- **`user`**: Properties that describe the user across all events
  - Examples: `User ID`, `User Email`, `User Tier`, `Account Created At`
  - Use when: The property represents persistent user attributes

- **`super`**: Properties sent with every single event (global context)
  - Examples: `Session ID`, `Platform`, `App Version`, `Device Type`
  - Use when: The property provides universal context for all events

## Data Types

Select the most appropriate data type:

- **`String`**: Text values
  - Examples: `"premium"`, `"ios"`, `"user@example.com"`, `"USD"`
  - Use for: Categories, IDs, emails, enum-like values

- **`Int`**: Whole numbers (integers)
  - Examples: `42`, `100`, `-5`, `0`
  - Use for: Counts, quantities, IDs (when numeric)

- **`Float`**: Decimal numbers
  - Examples: `99.99`, `3.14`, `0.75`
  - Use for: Prices, percentages, measurements

- **`Boolean`**: True/false values
  - Examples: `true`, `false`
  - Use for: Flags, toggles, yes/no states

- **`List`**: Arrays of values (all same type)
  - Examples: `["tag1", "tag2"]`, `[1, 2, 3]`
  - Use for: Multiple selections, collections

- **`JSON`**: Complex nested objects
  - Examples: `{"address": {"city": "NYC", "zip": "10001"}}`
  - Use for: Structured data, complex nested attributes

## Best Practices

### Property Reuse
- **Reuse existing properties** from the registry when semantically equivalent
- Example: If `User ID` exists as `String`, use it rather than creating `Customer ID`
- Benefits: Consistency across events, easier analysis

### Required vs Optional
- Mark a property as `is_required: true` only if the event is meaningless without it
- Example: `Order ID` is required for "Order Completed" but `Promo Code` is optional
- Prefer optional when in doubt to avoid tracking failures

### Descriptions
- Keep property descriptions concise (one sentence)
- Focus on what the property represents, not how it's used
- Example: `"Unique identifier for the shopping cart"` not `"This is used to track the cart throughout the session"`

### Example Values
- Provide realistic example values that show the expected format
- Examples:
  - `User Email`: `"user@example.com"` (not `"email"`)
  - `Cart Total`: `"99.99"` (shows decimal format)
  - `Platform`: `"ios"` or `"android"` (shows expected values)

### Duplicate Detection
- If an event seems very similar to an existing event, set `duplicate_of_name` to the exact existing event name
- Be conservative: only flag as duplicate if the events track the same user action
- Example: "User Registered" and "User Signed Up" are likely duplicates
- Example: "Cart Viewed" and "Checkout Started" are NOT duplicates (different actions)

### Event Categories
- Use categories to group related events
- Common categories: `authentication`, `ecommerce`, `engagement`, `navigation`
- Categories should be lowercase, singular nouns
- Can be `null` if no clear category fits

### Reasoning
- Always provide a brief explanation for why this event is needed
- Reference specific requirements from the PRD
- Example: `"Tracks when users begin checkout process, needed to measure funnel conversion per Section 3.2 of PRD"`
