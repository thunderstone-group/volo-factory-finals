window.SEED = {
  session: null,
  users: [{ id: 'u1', name: 'BookStack User', email: 'bookstack_user@example.com', password: 'Password123!' }],
  shelves: [
    { id: 'shelf_4_1', name: 'Shelf 4.1', description: 'Seeded shelf for REQ-4.1', tags: ['seed'], books: [] },
    { id: 'shelf_4_2_1', name: 'Shelf 4.2.1', description: 'Seeded shelf for REQ-4.2.1', tags: ['seed'], books: [] },
    { id: 'shelf_4_3_1', name: 'Shelf 4.3.1', description: 'Seeded shelf for REQ-4.3.1', tags: [], books: [] },
    { id: 'shelf_4_3_2', name: 'Shelf 4.3.2', description: 'Seeded shelf for REQ-4.3.2', tags: [], books: [] },
    { id: 'shelf_4_4_1', name: 'Shelf 4.4.1', description: 'Seeded deletable shelf for REQ-4.4.1', tags: [], books: [] },
    { id: 'shelf_4_4_2', name: 'Shelf 4.4.2', description: 'Seeded deletable shelf for REQ-4.4.2', tags: [], books: [] },
    { id: 'shelf_4_5_1', name: 'Shelf 4.5.1', description: 'Initial description for Shelf 4.5.1', tags: ['edit', 'shelf'], books: [] },
    { id: 'shelf_4_5_2', name: 'Shelf 4.5.2', description: 'Initial description for Shelf 4.5.2', tags: ['edit', 'shelf'], books: [] },
    { id: 'shelf_5_2_2', name: 'Shelf 5.2.2', description: 'Seeded shelf containing Book 5.2.2', tags: [], books: ['book_5_2_2'] },
    { id: 'shelf_5_6_1', name: 'Shelf 5.6.1', description: 'Seeded shelf for REQ-5.6.1', tags: [], books: [] },
    { id: 'shelf_7_1', name: 'Shelf 7.1', description: 'Seeded shelf for REQ-7.1', tags: [], books: [] },
    { id: 'shelf_7_2', name: 'Shelf 7.2', description: 'Seeded shelf for REQ-7.2', tags: [], books: [] }
  ],
  books: [
    { id: 'book_5_1', name: 'Book 5.1', description: 'Seeded book for REQ-5.1', tags: ['seed'], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_2_1', name: 'Book 5.2.1', description: 'Seeded book for REQ-5.2.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_2_2', name: 'Book 5.2.2', description: 'Seeded book for REQ-5.2.2', tags: [], shelfIds: ['shelf_5_2_2'], chapters: [], pages: [] },
    { id: 'book_5_4_1', name: 'Book 5.4.1', description: 'Initial description for Book 5.4.1', tags: ['edit', 'book'], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_4_2', name: 'Book 5.4.2', description: 'Initial description for Book 5.4.2', tags: ['edit', 'book'], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_5_1', name: 'Book 5.5.1', description: 'Seeded deletable book for REQ-5.5.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_5_5_2', name: 'Book 5.5.2', description: 'Seeded deletable book for REQ-5.5.2', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_1_1', name: 'Book 6.1.1', description: 'Seeded book for REQ-6.1.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_1_2', name: 'Book 6.1.2', description: 'Seeded book for REQ-6.1.2', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_1_3', name: 'Book 6.1.3', description: 'Seeded book with draft for REQ-6.1.3', tags: [], shelfIds: [], chapters: [], pages: ['page_draft_6_1_3'] },
    { id: 'book_6_2_1', name: 'Book 6.2.1', description: 'Seeded book for REQ-6.2.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_6_3_1', name: 'Book 6.3.1', description: 'Seeded book for REQ-6.3.1', tags: [], shelfIds: [], chapters: [], pages: ['page_6_3_1'] },
    { id: 'book_6_3_2', name: 'Book 6.3.2', description: 'Seeded book for REQ-6.3.2', tags: [], shelfIds: [], chapters: [], pages: ['page_6_3_2'] },
    { id: 'book_8_1', name: 'Book 8.1', description: 'Seeded book for REQ-8.1', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_8_2', name: 'Book 8.2', description: 'Seeded book for REQ-8.2', tags: [], shelfIds: [], chapters: [], pages: [] },
    { id: 'book_9_1', name: 'Book 9.1', description: 'Seeded book for REQ-9.1', tags: [], shelfIds: [], chapters: [], pages: ['page_9_1'] }
  ],
  pages: [
    { id: 'page_6_3_1', bookId: 'book_6_3_1', chapterId: null, title: 'Page 6.3.1', content: 'Content for Page 6.3.1 in Book 6.3.1.', draft: false, updatedAt: Date.now() },
    { id: 'page_6_3_2', bookId: 'book_6_3_2', chapterId: null, title: 'Page 6.3.2', content: 'Content for Page 6.3.2 in Book 6.3.2.', draft: false, updatedAt: Date.now() },
    { id: 'page_draft_6_1_3', bookId: 'book_6_1_3', chapterId: null, title: 'Draft 6.1.3', content: 'Seeded draft content for REQ-6.1.3.', draft: true, updatedAt: Date.now() },
    { id: 'page_9_1', bookId: 'book_9_1', chapterId: null, title: 'Page 9.1', content: 'Seeded page content for Book 9.1.', draft: false, updatedAt: Date.now() }
  ],
  chapters: [],
  favorites: [],
  recentlyViewed: []
};
