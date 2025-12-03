"""
Seed script to populate sample events and properties for demonstration
"""
import requests

API_BASE = "http://localhost:8000/api"

# Sample events with properties
sample_events = [
    {
        "name": "Content Shared",
        "description": "User shares content to an external platform",
        "category": "Engagement",
        "created_by": "admin@example.com",
        "properties": [
            {
                "property_name": "content_id",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "abc123",
                "description": "Unique identifier for the shared content"
            },
            {
                "property_name": "share_method",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "copy_link",
                "description": "Method used to share (copy_link, email, social)"
            },
            {
                "property_name": "user_id",
                "property_type": "user",
                "data_type": "String",
                "is_required": False,
                "example_value": "user_789",
                "description": "Unique user identifier"
            }
        ]
    },
    {
        "name": "Screen Viewed",
        "description": "User views a screen or page",
        "category": "Navigation",
        "created_by": "admin@example.com",
        "properties": [
            {
                "property_name": "screen_name",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "home_screen",
                "description": "Name of the screen viewed"
            },
            {
                "property_name": "referrer",
                "property_type": "event",
                "data_type": "String",
                "is_required": False,
                "example_value": "search",
                "description": "Previous screen or referrer source"
            },
            {
                "property_name": "user_id",
                "property_type": "user",
                "data_type": "String",
                "is_required": False,
                "example_value": "user_789"
            }
        ]
    },
    {
        "name": "Purchase Completed",
        "description": "User successfully completes a purchase",
        "category": "Transaction",
        "created_by": "admin@example.com",
        "properties": [
            {
                "property_name": "order_id",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "ORD-12345"
            },
            {
                "property_name": "total_amount",
                "property_type": "event",
                "data_type": "Float",
                "is_required": True,
                "example_value": "49.99"
            },
            {
                "property_name": "currency",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "USD"
            },
            {
                "property_name": "user_id",
                "property_type": "user",
                "data_type": "String",
                "is_required": True,
                "example_value": "user_789"
            }
        ]
    },
    {
        "name": "Button Clicked",
        "description": "User clicks an interactive button element",
        "category": "Engagement",
        "created_by": "admin@example.com",
        "properties": [
            {
                "property_name": "button_name",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "signup_cta"
            },
            {
                "property_name": "button_location",
                "property_type": "event",
                "data_type": "String",
                "is_required": False,
                "example_value": "header"
            }
        ]
    },
    {
        "name": "User Signup",
        "description": "New user completes registration",
        "category": "User",
        "created_by": "admin@example.com",
        "properties": [
            {
                "property_name": "signup_method",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "email"
            },
            {
                "property_name": "user_id",
                "property_type": "user",
                "data_type": "String",
                "is_required": True,
                "example_value": "user_123"
            },
            {
                "property_name": "referral_code",
                "property_type": "event",
                "data_type": "String",
                "is_required": False,
                "example_value": "FRIEND20"
            }
        ]
    }
]

def seed_database():
    print("🌱 Seeding database with sample events...")

    for event in sample_events:
        try:
            response = requests.post(f"{API_BASE}/events", json=event)
            if response.status_code == 200:
                print(f"✅ Created event: {event['name']}")
            else:
                print(f"❌ Failed to create event: {event['name']} - {response.text}")
        except Exception as e:
            print(f"❌ Error creating event {event['name']}: {str(e)}")

    print("\n✨ Seeding complete!")
    print(f"📊 Visit http://localhost:5173 to view the application")

if __name__ == "__main__":
    seed_database()
