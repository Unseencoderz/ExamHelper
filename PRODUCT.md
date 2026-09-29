# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students using a Windows desktop companion and its browser workspace to manage captured screenshots, clipboard text, and saved snippets.

## Product Purpose

ExamHelper connects a silent Windows desktop client to a browser dashboard. It lets students capture and manage screenshots, keep clipboard content available in the workspace, and use text snippets and configurable capture shortcuts. Success means the desktop-to-browser workflow feels dependable and effortless.

## Positioning

ExamHelper combines a silent Windows background client with a real-time browser workspace, so screenshots, clipboard history, snippets, and capture settings stay synchronized in one place rather than being handled as separate utilities.

## Operating Context

Users run the Windows desktop client alongside a browser dashboard. The client captures screenshots, syncs plain-text clipboard history, and receives snippets and hotkey settings. The web workspace supports active and archived screenshots, clipboard history, snippets, and administrative settings.

## Capabilities and Constraints

- Screenshot dashboard with preview, crop-to-copy, bulk actions, archive restore, and permanent deletion.
- Real-time text snippet and screenshot-hotkey management for the connected Windows client.
- Two-way plain-text clipboard synchronization, retaining up to 50 history entries.
- Screenshot metadata, snippets, configuration, and clipboard history are stored in Supabase; screenshot images are stored in Cloudinary.
- Archive and settings require an administrator session; active screenshots, snippets, clipboard history, and archive actions have the access behavior documented in the repository.
- Frontend is an existing React and Vite web application; preserve its product functionality while redesigning the interface.

## Brand Commitments

The redesigned frontend must feel consistent, seamless, and high quality. No binding visual style, palette, typography, or brand assets have been specified.

## Evidence on Hand

Repository documentation and implementation describe the current application, including its dashboard, desktop client, API, and persistence model. No testimonials, customer logos, performance benchmarks, or external proof assets are available and must not be fabricated.

## Product Principles

- Keep the desktop-to-browser workflow simple and dependable.
- Make current state, connections, and important actions easy to understand at a glance.
- Preserve the practical utility of screenshots, clipboard content, snippets, and capture settings.
- Treat destructive and administrative actions with appropriate clarity and safeguards.
- Make the browser workspace feel cohesive rather than like a collection of disconnected tools.
