"""Cobra NATS product + hygiene crew — visible features and maintenance."""

from __future__ import annotations

import os
from typing import Any

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task

from cobra_nats_crew.llm import build_llm
from cobra_nats_crew.paths import OUTPUT_DIR
from cobra_nats_crew.tools.factory import build_implement_tools


def _llm() -> LLM:
    return build_llm()


def _truthy(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


@CrewBase
class CobraNatsProductCrew:
    """Sequential product/hygiene crew. Writes source; never touches git remotes."""

    agents_config = "config/product_agents.yaml"
    tasks_config = "config/product_tasks.yaml"

    def __init__(self) -> None:
        self._tools: list[Any] | None = None

    def tools(self) -> list[Any]:
        if self._tools is None:
            self._tools = build_implement_tools()
        return self._tools

    def _agent(self, key: str, max_iter: int) -> Agent:
        return Agent(
            config=self.agents_config[key],
            tools=self.tools(),
            llm=_llm(),
            verbose=True,
            allow_delegation=False,
            max_iter=max_iter,
        )

    @agent
    def hygiene_engineer(self) -> Agent:
        return self._agent("hygiene_engineer", 20)

    @agent
    def nats_client_engineer(self) -> Agent:
        return self._agent("nats_client_engineer", 25)

    @agent
    def frontend_engineer(self) -> Agent:
        return self._agent("frontend_engineer", 35)

    @agent
    def backend_engineer(self) -> Agent:
        return self._agent("backend_engineer", 35)

    @agent
    def qa_engineer(self) -> Agent:
        return self._agent("qa_engineer", 25)

    @agent
    def docs_writer(self) -> Agent:
        return self._agent("docs_writer", 15)

    @agent
    def implement_reporter(self) -> Agent:
        return self._agent("implement_reporter", 8)

    def _task(self, key: str, filename: str, context: list[Task] | None = None) -> Task:
        kwargs: dict[str, Any] = {
            "config": self.tasks_config[key],
            "output_file": str(OUTPUT_DIR / filename),
        }
        if context:
            kwargs["context"] = context
        return Task(**kwargs)

    @task
    def item_hygiene(self) -> Task:
        return self._task("item_hygiene", "ph-01-hygiene.md")

    @task
    def item_nats_v3(self) -> Task:
        return self._task("item_nats_v3", "ph-02-nats-v3.md", [self.item_hygiene()])

    @task
    def item_dashboard(self) -> Task:
        return self._task("item_dashboard", "ph-03-dashboard.md", [self.item_hygiene()])

    @task
    def item_comparison(self) -> Task:
        return self._task(
            "item_comparison",
            "ph-04-comparison.md",
            [self.item_dashboard()],
        )

    @task
    def item_payload_palette(self) -> Task:
        return self._task(
            "item_payload_palette",
            "ph-05-payload-palette.md",
            [self.item_comparison()],
        )

    @task
    def item_kv_watch(self) -> Task:
        return self._task(
            "item_kv_watch",
            "ph-06-kv-watch.md",
            [self.item_payload_palette()],
        )

    @task
    def item_stream_212(self) -> Task:
        return self._task(
            "item_stream_212",
            "ph-07-stream-212.md",
            [self.item_nats_v3(), self.item_kv_watch()],
        )

    @task
    def item_topology(self) -> Task:
        return self._task(
            "item_topology",
            "ph-08-topology.md",
            [self.item_stream_212()],
        )

    @task
    def item_services_backup(self) -> Task:
        return self._task(
            "item_services_backup",
            "ph-09-services-backup.md",
            [self.item_topology()],
        )

    @task
    def item_qa(self) -> Task:
        return self._task(
            "item_qa",
            "ph-10-qa.md",
            [
                self.item_hygiene(),
                self.item_nats_v3(),
                self.item_dashboard(),
                self.item_comparison(),
                self.item_payload_palette(),
                self.item_kv_watch(),
                self.item_stream_212(),
                self.item_topology(),
                self.item_services_backup(),
            ],
        )

    @task
    def item_docs(self) -> Task:
        return self._task("item_docs", "ph-11-docs.md", [self.item_qa()])

    @task
    def item_report(self) -> Task:
        return self._task(
            "item_report",
            "ph-00-report.md",
            [
                self.item_hygiene(),
                self.item_nats_v3(),
                self.item_dashboard(),
                self.item_comparison(),
                self.item_payload_palette(),
                self.item_kv_watch(),
                self.item_stream_212(),
                self.item_topology(),
                self.item_services_backup(),
                self.item_qa(),
                self.item_docs(),
            ],
        )

    @crew
    def crew(self) -> Crew:
        check_mode = _truthy("CREW_CHECK", "false")
        return Crew(
            agents=list(self.agents),
            tasks=self.tasks,
            process=Process.sequential,
            verbose=not check_mode,
            memory=False,
            planning=False,
            planning_llm=None,
            cache=False,
            tracing=False,
        )
