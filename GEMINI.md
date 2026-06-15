# TechNuVate Website

TechNuVate is an EdTech platform providing affordable tech skills training, digital services, and talent placement for Africans and English speakers globally. This repository contains the source code for the platform's website.

## Project Overview

The project is a static website built with vanilla web technologies. It features several landing pages for different services offered by TechNuVate, including the Academy, Studio, Labs, and a Store.

- **Type:** Static Website (Non-Code Project)
- **Primary Technologies:** HTML5, CSS3, Vanilla JavaScript
- **Integrations:** Flutterwave (for payments/donations)

## Directory Structure

- `TechNuVate Website/`: Contains the main HTML pages of the website.
  - `index.html`: The homepage.
  - `academy.html`: Information about tech skills training.
  - `studio.html`: Digital services and solutions.
  - `labs.html`: Innovation and project-based learning.
  - `donate.html`: Support the platform.
  - `enroll.html`: Registration for courses.
  - `store.html`: Platform shop.
  - `js/`: JavaScript assets.
    - `env.js`: Environment configuration (e.g., Flutterwave public keys).

## Key Components

### Styling
The website uses extensive custom CSS embedded directly within the `<style>` tags of the HTML files. It follows a consistent color palette defined by CSS variables (e.g., `--navy`, `--navy2`, `--navy3`).

### Interactivity
Interactivity (like navigation menus, accordions, and modals) is handled using vanilla JavaScript within `<script>` tags at the bottom of the HTML files.

### Payments
Payment processing is integrated via the Flutterwave script (`checkout.flutterwave.com/v3.js`). Configuration for this is found in `TechNuVate Website/js/env.js`.

## Usage & Development

Since this is a static project, no build step is required.

### Local Development
To view the website locally, open any of the `.html` files in a web browser. Using a local server (like the "Live Server" extension in VS Code) is recommended to ensure all paths and scripts load correctly.

### Environment Configuration
Sensitive or environment-specific keys (like Flutterwave keys) should be managed in `TechNuVate Website/js/env.js`.
