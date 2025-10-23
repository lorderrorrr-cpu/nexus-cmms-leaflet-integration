flowchart TD
    A[Sign In] --> B[Dashboard]
    B --> C[Master Data Management]
    B --> D[Ticketing Module]
    D --> E[Create Ticket]
    D --> F[View Tickets]
    F --> G[Ticket Details]
    B --> H[Live Ticket Map]
    C --> I[Location Map]
    E --> J[GPS Verification Map]
    G --> K[PDF Jobcard Generation]
    E --> D1{Online or Offline}
    D1 -->|Online| F
    D1 -->|Offline| L[Offline Sync]
    L --> F
    B --> M[Sign Out]