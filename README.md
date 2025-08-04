# DSA Visualizer: A Step-by-Step Code Execution Tool

Welcome to the **DSA Visualizer**, an interactive web application designed to help you understand how your code executes, line by line. Built with **React** and **Node.js**, this tool provides a clear, visual representation of your algorithms—making it easier to learn, debug, and master complex data structures in both **Python** and **C++**.

---

## Features

- **Dual Language Support**: Visualize code written in both **Python** and **C++**.

- **Interactive Playback Controls**:  
  A beautiful, animated dock with full control over execution flow:
  - ▶️ Play  
  - ⏸️ Pause  
  - ⏩ Step Forward  
  - ⏪ Step Backward  
  - ⏮ Jump to Beginning / ⏭ Jump to End

- **Step-by-Step Execution**:  
  The currently executing line is **highlighted** directly in the editor.

- **Detailed Variable Display**:  
  View the state of **all variables** at every step of execution.

- **Advanced Data Structure Visualization**:  
  Rich, intuitive visualizations for a wide range of common data structures:
  - **Python**: `list`, `dict`, `set`, `tuple`, and custom class instances (e.g., trees, linked lists)
  - **C++**:
    - `std::string`, `std::vector`, `std::list`, `std::deque`
    - `std::map`, `std::multimap`, `std::unordered_map`
    - `std::set`, `std::multiset`, `std::unordered_set`
    - `std::stack`, `std::queue`, `std::priority_queue`
    - `std::pair`, `std::tuple`, `std::bitset`

- **Animated Step Counter & Jumper**:  
  An animated counter shows the current step. Clicking it opens a step-jump list.

- **Responsive Design**:  
  Clean, mobile-friendly interface that works on all screen sizes.

---

## Prerequisites

Make sure you have the following installed:

- **Node.js and npm**: Required to run the React frontend and Node.js backend. [Download here](https://nodejs.org)
- **Docker Desktop**: Required for securely compiling/executing C++ code in isolated containers. [Download here](https://www.docker.com/products/docker-desktop/)
- **Python**: Required for Python code visualization. [Download here](https://www.python.org)

> **Important**: Ensure Docker Desktop is **running** before starting the backend!

---

## Local Setup and Running

### 1. Backend Setup

```bash
# 1. Clone the repository (if not already done)
git clone <https://github.com/AbhiSan2005/DSA-Debugger>

# 2. Navigate to the backend directory
cd debugger-app/server

# 3. Install dependencies
npm install

# 4. Start the backend server (ensure Docker is running)
node server.js
```
### 2. Frontend Setup

```bash
# 1. Install dependencies
npm install

# 2. Open a new terminal and go to the frontend directory
cd ./debugger-app

# 2. Install dependencies (again)
npm install

# 3. Start the React dev server
npm run dev
```
## You're all Set!

- Frontend runs at: http://localhost:5173 (or a similar port)

- The Frontend is already configured to connect to the backend at http://localhost:3001.

## Happy Debugging!
