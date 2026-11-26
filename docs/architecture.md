# Frontend architecture

The catalog, search, track metadata, karaoke status, audio and lyrics use the configured HTTPS API. No fictional content or generated audio in the runtime. Browser preferences and real track references are local until authenticated server synchronization is available. API errors are explicit. Design system uses semantic CSS variables and reusable components; the player uses one clock and two gain nodes.
