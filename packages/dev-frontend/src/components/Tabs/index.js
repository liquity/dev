import cn from "classnames";

import classes from "./Tabs.module.css";

const Tab = ({ tab, setActiveTab, activeTab, content }) => (
  <div
    className={cn(classes.tab, {
      [classes.tabActive]: activeTab === tab
    })}
    onClick={() => setActiveTab(tab)}
  >
    {content}
  </div>
);

const Tabs = ({ setActiveTab, activeTab, tabs, className }) => (
  <div
    className={cn(classes.tabs, className, {
      [classes.oneTab]: tabs.length === 1,
      [classes.twoTabs]: tabs.length === 2,
      [classes.threeTabs]: tabs.length === 3
    })}
  >
    {tabs.map(t => (
      <Tab setActiveTab={() => setActiveTab(t.tab)} activeTab={activeTab} key={t.tab} {...t} />
    ))}
  </div>
);

export default Tabs;
